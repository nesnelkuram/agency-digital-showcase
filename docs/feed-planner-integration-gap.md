# Feed + Story planlayıcı — entegrasyon gap raporu

Durum: **yerel kod uygulandı (bu belgenin sonundaki §7), dağıtılmadı ve gerçek modelle denenmedi**. Canlıya hiçbir şey yazılmadı, hiçbir model/API çağrılmadı, `.env` okunmadı. §1–§6 uygulama ÖNCESİ analizdir; §7 hangi bulgunun yerel kodla kapandığını ve neyin hâlâ açık olduğunu yazar.
Her iddia kaynak kod veya çalıştırılmış testle desteklenir; kanıt dosyaları aşağıda. Tahmin içeren yerler "TAHMİN" diye işaretlidir.

## 1. Kısa sonuç

Hedef ("tek butonla gerçek medyadan görsel + Türkçe metinli plan ve kalıcı seçimler") bugün **tamamlanamaz**. Engeller, çalışan kodla ölçüldü:

| Engel | Kanıt |
|---|---|
| Önceki araştırmada 447 görsel Canva klasöründe görünüyordu; Canva-only kayıt Studio orijinali değildir. **Canlı veritabanı bu çalışmada doğrulanmadı**, bu satır kesin gerçek olarak okunmamalıdır. | `api/canva/folder.ts` başlık yorumu; `persistenceMatrix` → `canva-only` |
| Canlı planlayıcı yalnız en yeni **200** medyayı görür, imleç/sayfalama yok. Kütüphane ekranı da 200. | `buildInventory` testi: 447 kayıtta 200 öğe, `truncated: true`, en eski 247 görünmez (`catalogLimit.test.ts`) |
| Özgün 3697×5546 fotoğraflar canlı Instagram hazırlık denetiminde **feed için `error`**, Story için `ok`. 133×200 Canva önizlemeleri feed için `error`. | gerçek `readinessFor` ölçümü (`brandMedia.test.ts`) |
| Reels için canlı şema **tek video** ister; fotoğraf "Reels kapağı taslağı" kaydedilemez. | `reels_needs_one_video` (`suggestion.test.ts`) |
| Öneri motoru her post için `HH:MM` ister; Dieci planı saatsiz. | `invalid_time` (planSuggest) |
| Kırpma/odak, Story görsel üstü metin, Story serisi, Kalsın, gerekçesiz eleme için canlı şemada alan **yok**. | `persistenceMatrix.test.ts` (kaynak taraması) |
| Dil sunucuda denetlenmiyor: İngilizce `captionDraft` kabul edilir. | `suggestion.test.ts` |
| Model erişimi `ANTHROPIC_API_KEY` (API faturalandırması) ve `PLAN_AI_SUGGEST_ENABLED=true` ister; varsayılan KAPALI. | `api/_lib/integrations/config.ts` |

## 2. Gerçek katalog ve plan bağlantısı

Mevcut sistem zaten bir hat sunar: `brand_media` → `buildInventory` → Sonnet çağrısı → `validateSuggestion` → `plan_suggestions` → insan "taslak ekle" → `createSocialPost`. Yeni olan **adaptörler**, bu hattın girdi/çıktısını planlayıcı modeline çevirir:

- `integration/fromBrandMedia.ts` — gerçek `brand_media` kaydı → aday. Kapsam = tenant+proje. **Fail-closed**: güvenilen host/bucket ilkesi (`MediaSourcePolicy`) verilmezse aday döndürülmez; `allowUnverified` açık opt-in'dir ve sonuç `verification: 'unverified'` olur, taslak yazma sözleşmesi bunu reddeder.
- `integration/fromSuggestion.ts` — sunucuda **saklanmış** öneri kümesi → plan. Slot/rol hizası yerleşen kareler üzerinden kurulur; gün sınırı marka saat dilimine göredir (gece yarısı +03 testli); carousel yerleşmez (tek slotla temsil edilemez) ve nedeniyle raporlanır.
- `integration/draftContract.ts` — slot → `createSocialPost` girdisi (gerçek `addSuggestionsAsDrafts` ile alan paritesi testli). Slotun gerçek içeriğiyle aday/medya/marka eşleşmesi zorunlu; sürüm anlık görüntüsüyle eski taslak yakalanır.
- `integration/feedbackContract.ts` — `/api/studio/feedback` gövdesi; gerçek `SuggestionFeedbackSchema` ile karar paritesi ve gerçek `recordSuggestionFeedback` ile uçtan uca (bellek-içi sahte Firestore) doğrulandı.

### Dil
Öneri metinleri **Türkçe**. Yerel şablonlar yalnız Marka Personası'ndaki Türkçe kayıtlı cümlelerdir (Dil Rehberi: kanıtsız cümle yazılmaz). Canlı sistem Türkçeyi yalnız prompt'la ister; sunucu denetlemez. Adaptör dili sezgiyle işaretler (`tr/en/unknown`); sezgi tutucudur: Türkçe harf/sözcük kanıtı yoksa `unknown` yazar (ör. "Pazarlamada serseri, mutfakta beyefendi." → `unknown`).

### Story serisi
Canlı şemada seri kimliği/rolü yok; her Story ayrı posttur. Aynı yerel gündeki ardışık Story'ler yalnız **çıkarımla** gruplanır. Aynı gün farklı ürünler de aynı gruba düşer, bu yüzden sonuç `series.supported: false` taşır, roller bilgi amaçlıdır ve metin başlık/gövdeye dağıtılmaz. Gerçek seri için seri kimliği ve rol alanı gerekir.

## 3. Model erişimi ve maliyet

- Canlı: `claude-sonnet-5-5`, resmi Anthropic SDK, `max_tokens 8000`, zaman aşımı 120 sn, envanter ≤ 200 satır. Katalog analizi `claude-haiku-5-5`.
- Fiyat sabitleri koddan (kontrol tarihi 2026-10-10): Sonnet 5.5 giriş 2 / çıkış 10 USD per milyon token; Haiku 5.5 giriş 0,1 / çıkış 0,5.
- **TAHMİN** (gerçek usage ölçülmedi): 200 satır ≈ 24K giriş + ≤ 8K çıkış → plan çağrısı başına üst sınır ≈ **0,13 USD**. 447 görsel için katalog (görsel başına ~1.600 giriş + ~600 çıkış varsayımıyla) ≈ **0,21 USD**; fiyat katmanı istek başınadır. Satır/görsel token sayıları varsayımdır.

### Claude Max oturumu ile "kontrollü yerel JSON" mümkün mü?
- **Backend'in aboneliği kullanması varsayılamaz.** Backend resmi SDK'yı kullanır ve `ANTHROPIC_API_KEY` ister (API faturalandırması). Bu repo veya testler, Claude Max aboneliğinin API anahtarı/kredisi sağladığını göstermez; bunu varsaymıyorum. Teyit Anthropic hesabından yapılmalıdır.
- Yerel kontrollü deney **teknik olarak mümkün ve yapıldı, model çağrısı olmadan**: elle yazılmış, `PlanSuggestionSchema` biçimli JSON gerçek `suggestWeeklyPlan`/`validateSuggestion` hattından geçirildi (`suggestion.test.ts`; model yerine sabit bir stub). Bu, doğrulama kurallarını ve adaptörleri kanıtlar.
- Aynı JSON'u bu oturumdaki modelle üretmek de mümkün olurdu (manuel, insan-döngülü, oturum kullanım limitinden harcar), ama bu tur "yeni model çağrısı yok" kısıtı nedeniyle yapılmadı. Bu yol uygulama içinden tetiklenemez, tekrar edilebilir ölçüm (gecikme, maliyet, hata oranı) vermez ve backend yerine geçmez.

## 4. Kalıcılık: mevcut olan ve olmayan

| Kavram | Durum | Karşılık / boşluk |
|---|---|---|
| Taslak post | mevcut | istemci `createSocialPost`, kural: yalnız `status=draft` |
| Plan + bağlama | mevcut | `createContentPlan` (paylaşım tokenı da üretir), `validPlanLink` |
| Gerekçeli ret (AI öneri) | mevcut | `/api/studio/feedback` → `content_feedback`; yalnız sunucuda saklanmış öneri + index + içerik hash |
| Gerekçeli ret (post) | kısmi | yalnız onay geçişiyle (`internal_reject`, `reopen`) |
| Ret → sonraki plan | mevcut | `loadPlannerFeedback` modele veri olarak girer |
| Kalsın (kalıcı kilit) | **yok** | alan/uç nokta yok |
| Ele ve yenisini getir (gerekçesiz) | **yok** | yalnız gerekçeli ret kalıcı |
| Feed ızgara sırası | kısmi | `gridPosition` alanı var, planlayıcı üretmiyor |
| Story serisi, görsel üstü metin, kırpma | **yok** | alan yok; metin `caption` olarak saklanır, kırpma kalıcı değil |
| Saatsiz plan | kısmi | şemada `scheduledAt` opsiyonel; motor saat ister; takvim tarihsizi göstermez |
| Katalog sayfalama | **yok** | 200 sınırı |
| Canva şablon/tasarım | **yok** | OAuth kapsamı yalnız `folder:read/write`, `asset:read/write`; tasarım/şablon/autofill/export yok |

### Kalıcı Kalsın/Ele için ÖNERİ (üretime hazır DEĞİL)
`integration/plannerState.ts` + `docs/proposals/planner-state.rules`. Kilit yalnız medyaya değil **öneri içerik hash'ine** (medya + metin) bağlıdır: aynı medyanın metni değişirse eski kilit düşer. Yetkili belge uygulanırken yerel kilitler önce temizlenir. Eleme kapasitesi aşılırsa sessizce kırpılmaz, açık hata verilir. Doğrulayıcı `null`/eksik/yanlış tipli kayıtta fırlatmaz.

Yerel emülatörde (canlı kurallarla bellekte birleştirilerek) kanıtlananlar: tenant/proje erişimi (tenant geneli roller + atanmış marka yöneticisi/freelancer; başka tenant, atanmamış proje, müşteri, anonim reddedilir), plan–proje bağı, `updatedBy` oturumla aynı, boyut sınırları, güncellemede yalnız sürüm+1 (eski/tekrarlı yazım reddedilir), silme yalnız tenant geneli roller.

**Kanıtlanan SINIR:** kurallar liste **elemanlarını** doğrulamaz. `locks:[null]`, `dismissed:[null]`, eksik alanlı veya yanlış tipli elemanlar kuraldan GEÇER (emülatör testi); yalnız `validatePlannerStateDoc` bunları yakalar. Bu nedenle bu kural **üretime hazır veya tam güvenli kalıcılık olarak sunulamaz**. Gerçek yazım için ya zorunlu sunucu doğrulaması ya da kurallarda doğrulanabilir belge biçimi (ör. her kilit/eleme ayrı alt belge) gerekir. Mevcut `firestore.rules`'a ekleme veya dağıtım yapılmadı.

## 5. Canlı koddaki bulgular (düzeltilmedi, yalnız bildirildi)
1. `isConsistentAsset`, boş dosya adlı klasör yolunu (`brand-media/t/p/a/`) tutarlı sayıyor; `buildInventory` böyle kaydı envantere alıyor (`catalogLimit.test.ts`). Adaptör bunu ayrıca reddediyor.
2. Sunucu doğrulaması dili denetlemiyor.
3. Özgün portre (2:3) fotoğraflar feed için doğrudan postlanamaz (oran < 4:5 ve genişlik > 1440); kırpılmış türev dosya gerekir, fakat kırpma kalıcı değil.

## 6. Tek somut sonraki adım
**Dieci projesinin Studio kütüphanesine 9 seçili özgün fotoğrafı (Story'de `ok`) yükleyin** ve ilk pilotu Story-only olarak çalıştırın. Gerekçe: Canva-only kayıtlar planlanamıyor, yalnız bu 9 dosyanın özgün kaynağı elde ve Story hazırlık denetimini geçiyor. Bu adım kimlik bilgisi gerektirmez; yüklenince aynı adaptörler gerçek kayıtlara uygulanabilir.

## Kanıt dosyaları
`tests/feedPlanner/integration/*.test.ts`, `tests/rules/plannerStateProposal.rules.test.ts`, `studio/feedPlanner/integration/*`, `docs/proposals/planner-state.rules`.

## 7. Uygulanan yerel kod (bu çalışma) ve açık kalanlar

Hepsi yerel kod ve testtir; dağıtım, canlı veri yazımı ve gerçek model çağrısı yoktur.

**Kapanan**
- **Şablon yok:** normal akışta sabit Türkçe şablonlar kaldırıldı (`templateTextFor` yalnız test/QA). Metin yalnız `/api/studio/plan-copy` (sunucu: marka sesi paketi + hesap captionları + üç kılavuz + seçilen medyanın sunucuda yüklenen kataloğu + doğrulanmış ürünler). Model yok/hata → slotta ve üstte açık hata, plan "TAMAMLANMADI"; şablonla doldurulmaz.
- **Görsel + metin tek sürüm:** `proposeSlot` → model → `commitSuggestion` (sürüm kontrollü); hata/ret/alternatif yok → mevcut görsel+metin aynen kalır. Kalsın ikisini korur.
- **Sunucu doğrulayıcı:** Türkçe zorunlu, kanıtsız içerik/ürün yasağı, hesap gönderisine/slotlara benzerlik, imza söz tekrarı, kanıt temeli enum'u. Test: sahte modelle (gerçek model çalışmadı).
- **Kalıcı taslak** (`/api/studio/planner-draft`, yalnız Admin SDK; istemci kuralı yok): liste elemanları dahil şema ve sınırlar, tenant/proje/marka/medya kimlikleri, iyimser sürüm, idempotency (anahtar + **tenant + proje + hafta + yük** kapsamlı; aynı anahtar başka projede 409), medya/seri/kaynak doğrulaması **aynı transaction içinde**. `planner-state.rules` önerisi bununla yerine geçti (kural liste elemanlarını doğrulayamadığı için kullanılmıyor).
- **Seri kimliği:** kayıtta yalnız medyanın insan-doğrulamalı ürün bağlantısındaki `seriesKey` kabul (`series_unverified`). Story serisi yalnız bu kimlikten/planın açık seri adından kurulur; aynı gün seri değildir; ≤3 kare.
- **Model kaynağı güvenilmez:** `source:'model'` metin kaydederken hash (medya+rol+metin) yeniden hesaplanır ve sunucunun `plan-copy` sırasında yazdığı `planner_copy_issued` kaydıyla eşleşmelidir; aksi `provenance_invalid`. `plan`/`manual` metin model kanıtı alanı taşıyamaz, "model" diye sunulmaz.
- **Sayfalı katalog** (`/api/studio/planner-inventory`): 100'lük sayfalar, imleç = tam saniye + nanosaniye + belge kimliği; istemci imleç tükenene kadar ister; imleç döngüsü/500 sayfa üst sınırı açık hata. Studio'da `Planlayıcı` sekmesi (`/studio/:proje/planlayici`) bunu kullanır.
- **Emülatör testleri** (demo-*, alternatif portlar): bozuk liste, başka marka/tenant, eski sürüm, aynı isteğin tekrarı, aynı anahtar+boş yük iki projede, yeniden yükleme, eşzamanlı yazım, medya yarışı, nanosaniye/eşit zaman damgası imleci, istemci erişim reddi.

**Hâlâ açık (karıştırılmamalı)**
- `StudioLibraryPage`/`listBrandMedia` (ve seçici/çekmece) **hâlâ en yeni 200** kaydı listeler; sayfada bu açıkça yazılıdır. Planlayıcı sayfalaması bunları değiştirmez.
- Eski `plan-suggest` hâlâ en yeni 200 medyayı görür; panel artık `inventory.truncated` ise bunu gösterir.
- **Gerçek model çalıştırılmadı.** Çalışması için dağıtım, `PLAN_COPY_AI_ENABLED` + API anahtarı ve yönetici olarak marka sesi paketi yüklemesi gerekir (kullanıcı adımı). Çıktı kalitesi, gecikme ve maliyet ölçülmedi.
- Kırpma/odak ve Story görsel üstü metin taslakta saklanır ama **post şemasında yoktur**; taslaktan post oluşturulurken taşınmaz.
- Yayımlanmış geçmiş Studio planlayıcıda bağlı değildir (tekrar/ritim yalnız planı dikkate alır).
- Studio sayfasının gerçek tarayıcıda (gerçek oturum + gerçek Storage) uçtan uca denemesi yapılmadı; yalnız bileşen/birim/emülatör testleri ve yerel inceleme derlemesi vardır.

## 8. Model sağlayıcısı: OpenRouter (plan-copy)

`/api/studio/plan-copy` modeli **yalnız OpenRouter** üzerinden çağırır (`api/_lib/planCopy/openrouterCopyCall.ts`); doğrudan Anthropic çağrısı ve Anthropic'e ücretli yedekleme bu akıştan kaldırıldı (`anthropicCopyCall.ts` silindi, `ANTHROPIC_API_KEY` artık gerekli değil ve yeterli de değil).
- **Anahtar:** yalnız sunucuda `OPENROUTER_API_KEY` (çağrı anında okunur; log/hata/yanıta yazılmaz). Bu çalışmada anahtar görülmedi, gerçek çağrı yapılmadı.
- **Özellik kapısı:** `PLAN_COPY_AI_ENABLED=true` + `OPENROUTER_API_KEY`. Model kimliği `PLAN_COPY_MODEL` (biçim `sağlayıcı/model`); yoksa varsayılan `anthropic/claude-sonnet-5.5`. **Bu OpenRouter kimliği doğrulanmadı** (canlı sorgu yapılmadı); yanlışsa OpenRouter 4xx döner ve slotta açık hata görünür, PLAN_COPY_MODEL ile düzeltilir.
- **Yönlendirme:** `provider.allow_fallbacks=false`, `require_parameters=true`, `models` yedek listesi yok, yeniden deneme yok.
- **Yapılandırılmış çıktı:** strict `json_schema` (zod şemasından üretilir) istenir; dönen içerik yine sunucuda `CopyOutputSchema` + `validateCopyOutput` ile doğrulanır.
- **Kayıt:** yanıt kimliği (`gen-…`), isteğe bağlı `x-request-id`, gerçekte çalışan model, usage ve sağlayıcının bildirdiği maliyet (`usage.cost`, USD) yanıtta ve `planner_copy_issued` kaydında; maliyet bildirilmezse `null` (yerel tahmin yok).
- `vercel.json`: `api/studio/plan-copy.ts` için `maxDuration: 120` eklendi (adaptör zaman aşımı 100 sn).
- Marka bağlamı, Türkçe doğrulama, Kalsın, ele-yenile, kalıcı taslak ve proje kapsamı değişmedi.

## 9. Tek ilerleme çubuğu, görsel-önce planlayıcı, rehbersiz ton, marka dilini birlikte oluşturma

Yalnız yerel kod ve mock testtir; dağıtım, push, canlı yapılandırma/veri yazımı, gerçek model çağrısı ve aktif Studio sekmesine müdahale yoktur.

**1) Uygulama genelinde yükleme** (`studio/library/uploadService.ts`, `studio/contexts/StudioUploadContext.tsx`, `studio/components/UploadTray.tsx`)
- Kuyruk sayfada değil `<AuthProvider>` altında, rotaların üstünde yaşar; Studio içi/dışı gezinme, sayfa unmount'u ve marka değişimi yüklemeyi **kesmez**.
- Her iş oluşturulurken **tenant + proje + marka adı + işi başlatan kullanıcı sabit bağlanır**; sonraki marka/tenant değişimi hedefi değiştirmez. Kuyruk yalnız **oturum** değişince (çıkış/başka kullanıcı) iptal edilir; yazılmakta olan katalog kaydı geri alınamaz (arka planda biter, arayüze/bildirime yansımaz).
- Varsayılan görünüm **tek toplam bar**: `bitenler/toplam` yalnız **katalog kaydı yazılan** dosyaları sayar; bar bayt oranıdır, "kayıt bekleyen" ayrı yazılır. Ayrıntı açılınca dosya durumları, tek tek ve toplu duraklat/devam/iptal/tekrar dene.
- Kararlı kimlikler, tamamlanan adımlar, kısmi tamamlanma, write-once/dedupe korunur: aynı dosya (ad+boyut+lastModified) aynı oturumda kuyruktaysa/bittiyse yeniden eklenmez; iptal/hatalı dosya yeniden eklenirse **aynı varlık kimliğiyle** kaldığı adımdan sürer.
- **Bağımlılık hatası** (`getDeps` reddi): işler sırada bekler, hata görünür; **otomatik yeniden deneme yoktur**, yalnız açık "Tekrar dene" tam bir yeni deneme yapar.
- Tarayıcı kapanırsa/yenilenirse kuyruk bellekte olduğu için gider: biten dosyalar kalır, yarım kalanlar için dosyalar **yeniden seçilmelidir** (arayüz bunu yazar). Garanti verilmez. Dosya içeriği özeti (hash) yoktur: kuyruktan kaldırılan bir dosya yeniden seçilirse yeni varlık açılır.

**2) Görsel / metin ayrımı** (`studio/feedPlanner/review/App.tsx`)
- "Post planı oluştur", elle atama, "Ele ve yenisini getir", "Başka adayla değiştir", ret sonrası doldurma, gezinme, seçim, biçim, kırpma **modeli çağırmaz**. Görsel hemen geçerli taslaktır; yeni görsele **eski metin taşınmaz**.
- Metin yalnız açık **"Metinleri üret"** (veya slottaki "Metin üret/Metni yenile") ile gelir. Durumlar ayrı: *henüz üretilmedi* (hata değil) · *üretiliyor* · *sağlayıcı kapalı (503)* · *onaylı marka dili yok (412)* · *gözlem yok* · *doğrulamadan geçmedi* · *hata*. Hiçbirinde görsel silinmez; bayat yanıt (slot beklerken değişti) yazılmaz.
- Kalsın görsel+metin çiftini korur; "Metinleri üret" ve slot yenileme Kalsın'lı ve metni olan çifte dokunmaz.
- Metinsiz taslak kaydedilir ve yeniden yüklenir; "kaydedildi" metin üretildi anlamına gelmez.

**3) Rehbersiz geçici ton** (`api/_lib/planCopy/planCopy.ts`, `shared/planner/copyContract.ts`)
- Ses kaynağı önceliği (onaylı olan **her zaman** geçici tona üstündür): yüklü marka sesi paketi → insan onaylı konuşmalı rehber → seçilen **geçici ton** → hiçbiri yoksa `412 brand_voice_missing` (`details.needs: tone_or_guide`). Sağlayıcı kapalı `503 feature_disabled` bundan **ayrıdır** (rehber durumuna bakılmadan).
- Geçici ton: etiket (enerjik/zarif/lüks/samimi/minimal/eğlenceli) ve/veya serbest tarif (≤300 karakter, tek satır, işaretleme temizlenir, yalnız `<tone>` VERİ bloğuna girer). **Olgu kaynağı değildir**; kalıcı onaylı marka hafızası değildir ve hiçbir yere yazılmaz (yalnız `planner_copy_issued` kaydında `voiceSource: temporary_tone`).
- Gözlem: katalog (sunucuda yüklenir) ve/veya istemcinin **ölçtüğü** piksel istatistikleri (palet, parlaklık, renk dengesi, kontrast, yoğunluk, boş alan; sunucu Türkçe tarife çevirir). İkisi de yoksa slot modele **gitmez**: `gorsel_gozlem_yok` (hepsi öyleyse model çağrılmaz, ücret yok).
- Doğrulama: yeni kanıt temelleri `olculen_gorsel` (yalnız ölçüm; içerik değil) ve `marka_rehberi`; rehbersiz modda persona/hesap/doğrulanmış ürün temelleri reddedilir; ürün/yiyecek/fiyat/saat/ödül/kampanya uydurma lexicon + yasak kalıplarla reddedilir (tarifteki olgu kelimesi kanıt sayılmaz). Varsayımlar yanıtta (`voice.assumptions`) ve slotta işaretlenir.
- Taslakta `voiceSource` saklanır; sunucu üretim kaydıyla karşılaştırır (`voice_source_mismatch`): geçici ton metni onaylı gibi kaydedilemez.

**4) Marka dilini birlikte oluştur** (`/api/studio/brand-guide`, `api/_lib/brandGuide/brandGuide.ts`, `studio/components/BrandGuideChat.tsx`) — **yazı dili**, ses/audio değil
- Yönlendirmeli sorular veya serbest brief → AI **taslak** (OpenRouter, strict json_schema; kapalıysa 503) → insan düzenler (`save`) → **yalnız yönetici + açık `confirm:true` + taslağın tam sürümü/içerik anahtarı** ile `brand_guides`'a onaylı sürüm yazılır (değişmez sürüm kopyası `brand_guide_versions`). AI hiçbir yolda onaylı rehbere yazamaz.
- Olgu uydurma koruması: ad/ne yapar/hedef kitle/örnekler kullanıcının sözleri (modelden alınmaz); `facts` brief'te dayanağı olmayanlar düşer ve açık soruya çevrilir; eksik alanlar sorulur.
- Mevcut onaylı rehber korunur: yeni onay `expectedApprovedVersion` ister (sessiz ezme yok), sürüm +1; yüklü marka sesi paketi varsa onay `409 bundle_guide_exists`.
- İyimser sürüm + idempotency (tenant+uid+eylem+anahtar), tenant/proje kimlik doğrulamasından. **Üretim çift ücretli çağrıya karşı korunur:** model çağrısından önce atomik `pending` rezervasyonu (anahtar kaydı + proje kilidi); eşzamanlı aynı anahtar → `request_pending` (model çağrılmaz), tamamlanmış → replay, başarısız → aynı hata (yeni deneme yeni anahtarla bilinçli), süresi dolmuş → `request_expired` (kör yeniden deneme yok), farklı yük → `idempotency_conflict`.

**5) Yapılandırma bulgusu (yalnız ad/hedef metadatası; değer okunmadı)**
- 503 mesajı "Plan metin üretimi kapalı (PLAN_COPY_AI_ENABLED)" kodda **yalnız** `process.env.PLAN_COPY_AI_ENABLED !== 'true'` iken üretilir (`copySuggestState`, anahtar eksikliği ayrı mesajdır).
- `vercel env ls production`: 23 değişkenden **`OPENROUTER_API_KEY` (Secret, Production) vardır; `PLAN_COPY_AI_ENABLED` ve `PLAN_COPY_MODEL` Production, Preview ve Development'ta tanımlı değildir.** Sabahki izole dağıtımın `--env` bayrağı o dağıtıma özgüdür; yeni dağıtıma taşınmaz (bu çıkarım dağıtım bayrağı geçmişi doğrulanmadığı için olasılıktır, ama bayrağın projede tanımsız olması ölçülmüş bir gerçektir).
- Önerilen (BU ÇALIŞMADA UYGULANMADI, kullanıcı adımı): Production'a `PLAN_COPY_AI_ENABLED=true` ekleyin, istenirse doğrulanmış OpenRouter kimliğiyle `PLAN_COPY_MODEL`; ardından yeniden dağıtın. Aynı bayrak marka rehberi taslağı üretimini de açar. Aktif yükleme sürerken dağıtım/yenileme yapmayın (aşağıya bakın).

**Kalan sınırlar**
- Gerçek model/OpenRouter bu çalışmada hiç çağrılmadı; model kimliği, çıktı kalitesi, gecikme, maliyet doğrulanmadı. Ölçülen-görsel temelli metin kalitesi (renk/ışık cümleleri) gerçek modelle denenmedi.
- Tohumlu varyasyon bandı (3 puan) sezgiseldir; kırpma otomatik optimize edilmez (varsayılan odak katalog konu konumundan; puanda "kırpma" = görünen kesir).
- Konuşmalı rehber arayüzü ve tüm yeni akışlar gerçek tarayıcıda denenmedi (bileşen/birim/mock/emülatör testleri).
- Dağıtım öncesi: açık bir Studio sekmesinde yükleme sürüyorsa, eski kod sekmede çalıştığı için gezinme yüklemeyi iptal eder; yeni dağıtımla eski karma adlı parçalar (chunk) 404 olabilir. Yüklemeler bitmeden dağıtmayın; sonra sekmeyi yenileyin.
