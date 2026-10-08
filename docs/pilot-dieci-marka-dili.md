# Pilot: Dieci marka dilinin motora aktarılması

> Durum: **MDD aktarım taslağı incelemede — Codex bulguları ve tartışma §7'de** · Başlangıç: 2026-09-30 · Sahibi: intiba
> Amaç: Elle tutulan, geri bildirimle defalarca güncellenmiş gerçek bir marka dilini [Marka Dili Motoru](./marka-dili-motoru.md) şemasına aktarmak. Böylece şemanın, [Metin Üretici](./metin-uretici-motoru.md)'nin ve geri bildirim döngüsünün (§7) gerçek bir vakada nerede yetmediği görülecek.
> K1 korunur: Dieci ana tasarımın temeli değil, **doğrulama vakasıdır**. Buradan çıkan şema değişiklikleri markadan bağımsız biçimde önerilir.

---

## 1. Kaynaklar

Kaynak klasör: `../Dieci/` (bu reponun dışında).

| Dosya | Boyut | İçerik | Motordaki yeri |
|---|---|---|---|
| `Dieci_Marka_Personasi.md` | ~19 KB | Kimlik, arketip, değerler, üç register, cümle mimarisi, imza sözler, kitle, görsel kimlik, deneyim, menü sözlüğü, yapılır/yapılmaz, copy ve şablon bankası | MDD (kimlik, ses, kurallar, örnekler) + bilgi kayıtları |
| `Dieci_Dil_Rehberi.md` | ~6.5 KB | Üretim talimatı: kanıtsız cümle yok, register seçimi, cümle mimarisi, dokuz ayıklama kapısı, kullanıcı düzeltmesinin kapsamı, seri çeşitliliği, uydurma yasağı | MDD kuralları + üretim politikası + ilk geri bildirim kaydı |
| `AGENTS.md` | ~5 KB | Ajan yönergeleri: stil seçimi, story ölçüsü, başlık yalnız ilk karede, kullanıcı düzeltmeleri | Kısmen MDD, kısmen görsel/format profili, kısmen geri bildirim geçmişi |
| `Dieci_Paylasim_Stilleri.md` | ~26 KB | Üç görsel paylaşım stili | **Kapsam dışı** (görsel modül). Metin motoruna girmez. |
| `output/dil-revizyonu-2026-09-26/karsilastirma.md` | — | Aynı fotoğraflar için eski ve yeni metinler, gerekçeli | Değerlendirme seti adayı (§5) |

Metin için gereken kısım (persona + rehber + ilgili AGENTS notları) Claude'da kabaca **10–12 bin token**. MDD'ye yapılandırılmış olarak aktarıldığında tek hedef için derlenen Ses Paketi'nin **3–5 bin token** civarına inmesi beklenir. Bu bir tahmindir, `countTokens` ile ölçülecek.

## 2. Alan alan eşleme

### 2.1 Kimlik ve ses (çoğu `locked: true`)

| Dieci kaynağı | MDD alanı | Not |
|---|---|---|
| Persona §0 "Tek cümlede Dieci", çekirdek sloganlar | `identity.oneLiner`, `identity.positioning` | Kilitli |
| §1 Arketip (Toxic Lover × Outlaw), "Indomita" | `identity.positioning`, `voice.personality` | Kilitli |
| §1 İki konuşma modu: Serseri (sosyal medya) / Beyefendi (mekân, tabak, fine-dining) | `contextAdaptations[]`: `when: { intent: "hype" }` / `when: { intent: "craft" \| "event" }` | Persona "bölünmez" diyor; iki ayrı ses değil, bağlam uyarlaması |
| §2 Vaat, manifesto, 5 değer | `identity.values`, `voice.principles` | "48 saat fermantasyon" gibi somut ifadeler **bilgi değildir** (§2.3) |
| §3 Kişilik sıfatları | `voice.personality` | Kilitli |
| §3 + Rehber §2 Üç register | **Şemada karşılığı yok** → §3.1 | Harry Dry · Gastro-şairane · Menefreghista |
| §3 Cümle mimarisi (negasyon → otorite → emir/geri alma) | `guidance` + zorunlu anlamsal kural "en az bir hamle görünür" | Rehber §3 |
| §3 İmza sözler, §9 copy bankası | `examples.good` + `localeProfiles.tr-TR.lexicon.preferred` | Aynen tekrar kullanım izni sorusu: §6 |
| §4 Hedef kitle (iki alt kitle), "kime hitap etmez" | `identity.audience[]` (`primary`, `secondary`) + `voice.weAreNot` | |
| §5 Emoji sözlüğü, hashtag setleri, imza künye | `rules` (emoji tercih listesi, hashtag seti) + bilgi kaydı (telefon numarası) | Künyedeki telefon bir **bilgi**dir |
| §5 Renk, tipografi, görsel dil | `visual.notes` | Metin motoru kullanmaz |

### 2.2 Kurallar

| Kaynak | Kural | `check` | `level` |
|---|---|---|---|
| Persona §8: "takipte kalın", "çok yakında" | `forbidden_phrase` | deterministic | required |
| Persona §8: alkol markasını açıkça anma | `claim_restriction` | semantic | required |
| Persona §8: pembe-çiçekli klişe romantizm | `tone_restriction` | semantic | advisory |
| Rehber §7: içerik, süre, menşe, ödül, menü adı uydurma | `claimsPolicy.requireEvidence: true` | semantic | required |
| Rehber §4.7 Yeterlilik kapısı: "-abilir/-ebilir" ile biten kapanış | `closing_pattern` (son cümle) | deterministic | required |
| Rehber §4.8 Sıfat kapısı: "enfes, eşsiz, özenle"… | `forbidden_phrase` listesi + kanıtsız sıfat için anlamsal kontrol | deterministic + semantic | required |
| Rehber §4.1 Altyazı kapısı (fotoğrafı tarif ediyor mu) | `not_caption` | semantic | required |
| Rehber §4.2 Özgüllük kapısı (özel ad, rakam, saat, teknik, duyulmuş söz) | `specificity` | semantic (rakam/özel ad tespiti kısmen deterministic) | required |
| Rehber §4.3 Değiştirme kapısı (ürün adı değişince hâlâ çalışıyor mu) | `product_swap_test` | semantic | required |
| Rehber §4.4 Sesli okuma kapısı | `speakable` | semantic | required |
| Rehber §4.5 İtiraz kapısı (katılmıyorum denebilir mi) | `has_claim` | semantic | required |
| Rehber §4.6 Duyurma kapısı (espriyi yapıyor mu, duyuruyor mu) | `no_announcing` | semantic | required |
| Rehber §4.9 Register kapısı | `register_identifiable` | semantic | required |

Dokuz kapının yedisi model değerlendirmesi ister. Bunlar hakem rubriğine değil **zorunlu anlamsal kontrollere** girer, çünkü rehber bunları "zevk sorusu değil, evet/hayır" diye tanımlıyor. Yanlış alarm oranı ayrıca ölçülür (ana doküman §8).

### 2.3 Bilgi kayıtları (doğrulama gerekiyor)

Rehber §7 açıkça söylüyor: *persona'daki bir ifade tek başına doğrulanmış ürün bilgisi değildir.* Aktarımda bunlar `needs_input` listesine girer. intiba ya da marka yetkilisi onaylayınca bilgi kaydı olur.

| Aday bilgi | Kaynak | Durum |
|---|---|---|
| Menü adları: The Ghosting (espresso), Lovebombing (tiramisu), Mixed Signals, The Red Flag (Diavola), Quattro Formaggi + acı bal | Persona §7, Rehber §7 | Rehberde "doğrulanmış" yazıyor. Yine de kaynak ve inceleyen kişi kaydı gerekir |
| 48 saat fermantasyon, kuru dinlendirme, açık ateş, el yapımı hamur | Persona §2 | **Doğrulanmadı** |
| Michelin gecesi fiyatı (5.500 TL) | Persona §4 | Doğrulanmadı + geçerlilik tarihi gerekir |
| Şef takeover'ları (isimler) | Persona §7 | Geçmiş etkinlik mi, tekrar eden mi? Tarih gerekir |
| Lovebombing ikramı, easter egg'ler (ayna, buton, peçete, altlık) | Persona §6 | Mekânda gerçekten var mı? |
| İmza künye telefon numarası | Persona §5 | Doğrulanmadı |
| Konum: Kadıköy | Persona §4 | Doğrulanmadı |

### 2.4 Geri bildirim geçmişi → ilk kayıtlar

Dosyalardaki elle yazılmış düzeltmeler yeni döngünün (§7) ilk kayıtlarına dönüşür. Bunlar aynı zamanda döngünün test verisidir (§5.2).

| Tarih | Olay | Doğru yorum | Kapsam |
|---|---|---|---|
| (21 Eyl öncesi) | Linguine örneği: "bizim stilimiz b" | `means`: bu anlatım uygun üründe çalışan bir seçenek · `doesNotMean`: her ürün kişileştirilsin, her metin espriyle bitsin | `post` → örnek havuzuna aday |
| 21 Eyl 2026 | 30 story: fotoğraflar uygun, metinler değil. Aynı ilişki esprisi her ürüne giydirilmiş | `dimension: repetition` · `means`: aynı hamle üst üste yok, her ürün ayrı fikir · `doesNotMean`: tonu yumuşat, ilişki mizahını bırak | `series` |
| 21 Eyl 2026 | Linguine, midye, burrata metinleri beğenilmedi, fotoğraflar "idare eder" | Metin: kötü örnek adayı. Fotoğraf: `media_fit`, ses kuralı değil | `post` |
| 21 Eyl 2026 | Story ölçüsü 1080×1920; siyah bant/panel ekleme; başlık yalnızca ilk karede | Format ve görsel kuralı. Metin tarafına düşen: seri içinde başlık yalnız ilk karede | `brand` (kullanıcının açık kuralı) |
| 26 Eyl 2026 | Dil rehberinin yeniden yazılması: eski sürüm "düzeltme listesine dönüştü, üretimi bozdu" | Yanlış genellemenin geri alınması. §7.8 vakası | — |

## 3. Şemada ve motorda açılan boşluklar

**Güncelleme — 2026-09-30:** Aşağıdaki maddeler ilk aktarımda saptanan ihtiyaçların kaydıdır. Register, metinsiz çıktı, set denetimi, ek deneme politikası ve `anyOf`, iki ana belgedeki teknik uzlaşıya alındı. Pilot JSONC'nin güncel sözleşmeyle hizalanması ve kaynak çelişkilerinin çözümü henüz tamamlanmadı; inceleme §7'de.

Her madde markadan bağımsız bir öneri olarak yazıldı. Dieci bunları gösteren vakadır, sebebi değildir.

### 3.1 Register'lar (yazım modları)

Mevcut şemada `voice` tek bir ses tarifi. Dieci aynı kişiliğin **birbirini dışlayan üç yazım modu** olduğunu ve her metnin birini seçmek zorunda olduğunu gösteriyor. Başka markalarda da görülür (ör. kurumsal / topluluk).

Öneri: `voice.registers[]` = `{ id, name, whenToUse, recipe, closingTest, examples[] }`. Buna ek olarak `registerPolicy: { required: boolean, mixing: "forbidden" | "allowed" }`. Strateji aşaması teknikle birlikte register da seçer. Aday kaydı `registerId` taşır.

### 3.2 Susma hakkı (metinsiz çıktı)

Rehber §1: kanıt yoksa kare **metinsiz geçer**. Motorun sonuç durumlarında "metin yok" yok. Şu an `no_valid_candidate` bir hata gibi davranıyor.

Öneri: `no_text` geçerli bir sonuç olsun. Gerekçe (hangi kanıt eksikti) ve "şu bilgi verilirse yazılabilir" notu taşısın. Seri üretiminde bazı karelerin metinsiz olması başarı sayılabilsin.

### 3.3 Seri düzeyinde kurallar

Rehber §6: *iki komşu seri aynı register'ı kullanamaz · en az 2 seri tek cümlelik · en az 2 seride rakam · iki metin aynı iskeleti kullanamaz · paralel üçleme sette en fazla bir kez.* Motorun denetimi sadece tek tek adaylara bakıyor.

Öneri: MDD'de `setRules[]` (kapsam: seri veya plan). Denetim iki katmanlı olur: aday denetimi + set denetimi. Set denetimi başarısızsa sadece ihlali oluşturan adaylar yeniden üretilir. Bu Studio'daki haftalık plan akışıyla da doğrudan örtüşüyor.

### 3.4 Onarım yerine at ve yeniden yaz

Rehber §4: *düzeltme ortalama üretir; silinir, baştan yazılır.* Hedefin üç katı yazılır, kapılardan geçemeyen gösterilmeden atılır. Metin üretici tasarımındaki "tek onarım turu" bununla çelişiyor.

Öneri: `generationPolicy: { overgenerate, onFail: "repair_once" | "discard_and_regenerate" }` MDD'de marka düzeyinde ayarlanabilsin. Her iki biçim de tek ek deneme ve motorun ortak bütçesi altında çalışır; "üç kat üretim" Dieci'nin tercihi, genel varsayılan değil. Hangisinin daha iyi sonuç verdiği pilotta ölçülür. İki yöntem aynı brief'lerle karşılaştırılır (maliyet + kabul oranı).

### 3.5 Hepsi ya da hiçbiri olmayan mimari kuralı

Rehber §3: *üç hamlenin hepsi zorunlu değil, ama hiçbirini kullanmayan metin Dieci metni değildir.* Mevcut kural tipleri "en az biri" mantığını taşımıyor.

Öneri: anlamsal kural parametresi `anyOf: [...]`. Alt kontroller `pass | fail | unknown` üretir: en az biri geçerse `pass`, hepsi kalırsa `fail`, hiçbiri geçmeyip en az biri belirsizse `unknown`. Zorunlu kuralda `unknown`, `needs_review` olur (metin üretici Tartışma, Codex madde 5).

## 4. Aktarım adımları

1. **MDD taslağı:** Üç dosyadan `brand_voice_drafts` şemasına JSON taslak — ilk sürüm: [pilot-dieci/mdd-taslak.jsonc](./pilot-dieci/mdd-taslak.jsonc). Her alan `sourceRefs` ile dosya ve bölüme bağlanır. Kilitli alanlar işaretlenir. Aktarımı model yapar, insan alan alan inceler.
2. **Bilgi doğrulaması:** §2.3 listesi intiba'ya gider. Doğrulanmayan hiçbir şey bilgi kaydı olmaz.
3. **Örnek havuzu:** Persona'daki alıntılar (kaynakta gerçek metin oldukları yazıyor) iyi örnek adayı olur. Hangilerinin öğretici örnek olarak onaylanacağı ayrıca seçilir. 21 Eylül'ün 30 story metni gerekçesiyle kötü örnek adayıdır.
4. **Değerlendirme seti:** §5.
5. **Şema önerileri:** §3'teki beş madde ana dokümana önerilir (markadan bağımsız ifadeyle), Codex ile tartışılır.

## 5. Değerlendirme

### 5.1 Metin kalitesi

- **Hazır eşleştirilmiş set:** `output/dil-revizyonu-2026-09-26/karsilastirma.md` aynı fotoğraflar için eski ve yeni metinleri, register ve "ne değişti" gerekçesiyle içeriyor. Yeni metinler henüz onaylanmadığı için "doğru cevap" sayılmaz, karşılaştırma girdisidir.
- **Kör karşılaştırma:** Aynı fotoğraf ve brief'lerle (a) eski hat, (b) yeni motor, (c) karşılaştırma dosyasındaki yeni metin. intiba hangisini seçerdi?
- **Kapı doğruluğu:** Dokuz kapının model kararları, intiba'nın aynı metinler için verdiği evet/hayır kararlarıyla karşılaştırılır (yanlış alarm ve kaçırma oranı).
- **Set çeşitliliği:** 10 serilik bir partide register dağılımı ve §3.3 kurallarına uyum.

### 5.2 Geri bildirim döngüsü (yeniden oynatma)

§2.4'teki olaylar, sırasıyla döngüye girdi olarak verilir. Geçme koşulu:

1. 21 Eylül olayı `repetition` + `series` kapsamıyla yorumlanır. `doesNotMean` içinde tonun yumuşatılmaması yer alır.
2. Tek olaydan marka kapsamlı öneri çıkmaz.
3. Yapay olarak "yumuşatma" önerisi yayına hazırlanırsa gerileme incelemesi (§7.6) register dağılımındaki çöküşü uyarı olarak öne çıkarır; yayınlayan kişi uyarıyı görmeden yayın tamamlanmaz.

## 6. Açık sorular (intiba)

1. Dieci uygulamada (Firestore) bir müşteri/proje olarak kayıtlı mı? Aktarılan MDD hangi `brandId`'ye bağlanacak?
2. İlk pilot ölçümü caption + hashtag çıktısıyla mı yapılacak, yoksa story karelerindeki başlık/gövde için ayrı bir çıktı sözleşmesi mi eklenecek? Kaynak örnekler çoğunlukla story üzerindeki metinler; mevcut ilk üretici kapsamı caption + hashtag.
3. Copy bankasındaki imza sözler aynen tekrar kullanılabilir mi, yoksa sadece öğretici örnek mi?
4. §2.3'teki bilgileri kim doğrulayacak: intiba mı, marka yetkilisi mi?
5. §3.4: Dieci'de "at ve yeniden yaz" politikası varsayılan mı kalsın, yoksa iki yöntem ölçülerek mi seçilsin?

## 7. Tartışma

<!-- Her katkı: ### [isim/agent] — YYYY-MM-DD başlığıyla en alta eklenir. -->

### [Claude — ana oturum] — 2026-09-30
İlk taslak. Dieci'nin elle tutulan dili, motorun üç eksiğini somut olarak gösteriyor: register kavramı, metinsiz çıktı ve seri düzeyinde denetim. Ayrıca onarım politikasında tasarımımızla çelişiyor. Bunları markadan bağımsız öneriler olarak ana dokümana taşımayı ve Dieci'nin geri bildirim geçmişini döngünün ilk test seti yapmayı öneriyorum.

### [Codex — MDD aktarımının kaynak ve sözleşme incelemesi] — 2026-09-30

**Sonuç:** Taslak marka karakterini ve üç yazım modunu taşıyor. Üretime bağlamadan önce kapsam, kural çelişkisi ve kaynak onayı konuları çözülmeli. Buradaki öneriler tonu yumuşatma talebi değildir; hangi kuralın hangi içerikte çalıştığını açık hale getirir.

İncelenen JSONC içerik özeti: `740a1852b022…`; 3 register, 14 aday kuralı, 5 set kuralı. JSONC ayrıştırılıyor. Ortak belgelerdeki şemalar henüz yürütülebilir doğrulayıcı olmadığı için bunu “MDD şema doğrulamasını geçti” olarak kaydetmiyorum. Persona (P), dil rehberi (R), kaynak AGENTS notları (A) ve 26 Eylül karşılaştırma dosyası doğrudan okundu. Taslaktaki kural/tercih değerlerini değiştirmedim; başına inceleme bağlantısı ve güncel şema notu ekledim. Bu belgedeki eski Rakle karşılaştırmasını da kullanıcının genel sistem kapsamına uygun çıktı sorusuyla değiştirdim.

#### 1. Üç ayrı değerlendirme birimi var: kare, seri ve seri partisi

R§2 ve A “her **seri** bir register seçer” diyor. R§6 ise **komşu serilerin** register'larını karşılaştırıyor. Bunları tek bir `set` veya tek metin düzeyine indirgersek, aynı serinin karelerine farklı register seçtiren bir motor ortaya çıkabilir.

| Kaynak gereği | Değerlendirme birimi | Aktarımda gereken bağ |
|---|---|---|
| Başlık yalnız ilk karede | Seri içindeki kare | Seri kimliği, kare sırası, başlık/gövde ayrımı |
| Bir register seç, karıştırma | Serinin tamamı | Seriye bağlı register seçimi; metinlerin buna uyumu |
| Komşu seriler farklı register | Sıralı seri partisi | Üye seriler, sıra ve parti sürümü |
| 10 seriden en az 2'si tek cümlelik | Tam seri partisi | Sayımın seri içindeki tüm metinleri nasıl birleştirdiği |

`setRules` üyelerinin türü ve `registerPolicy` seçim kapsamı bu ayrımı taşımalı. 10'dan az seri, yeniden sıralama, metinsiz kare ve bütünüyle metinsiz seri için davranış açık olsun; model kendi oranını veya sayım birimini üretmesin. Metinsiz kareyi “tek cümlelik seri” saymak hatalı olur. Bu, genel motorda üye türü ve kapsam ihtiyacıdır; Dieci'ye özel kod yolu gerektirmez.

**Çıktı sınırı:** `series-title-first-only` ve “kare metinsiz geçer” story üzerindeki yazıya ait. Caption + hashtag sözleşmesinde `frameIndex`, `title`, `body` yok. Bu nedenle `allowNoText: true` değerini tüm caption görevlerine yaymak veya başlık kuralını caption üzerinde çalışmış saymak doğru değil. Story metni için ayrı çıktı hedefi tanımlanabilir; ilk caption pilotunda bu kuralların desteklenmeyen kapsamı açıkça raporlanmalı. Eksik kapsam sessizce `pass` olamaz.

#### 2. Kaynak kendi örnekleriyle çelişebiliyor; bu çelişkiyi taslak gizlememeli

Aşağıdakiler motorla ölçülmüş sonuçlar değil, kuralların sözel koşullarıyla kaynak örneklerin karşılaştırmasıdır:

| Kaynaktaki örnek/ilke | Çakışan aktarım | Tartışılacak çözüm |
|---|---|---|
| “Biz çoktan seçtik. Siz sadece masaya oturun.” (R§2C) | `gate-specificity` saydığı işaretleri zorunlu tutuyor; `gate-product-swap` ürün içermeyen marka tavrına da uygulanıyor | Kuralın ürün/marka tavrı kapsamı ve kayıtlı marka kanaatinin dayanak oluşu tanımlansın |
| Grana Padano + karabiber, ardından “Standartlarını düşürme.” (R§2B) | `gate-not-caption`, kare tarif edilebiliyorsa tamamını reddediyor | “Salt betimleme” ile somut anlatım + marka kanaati/emri ayrımı kaynak sahibine sunulsun |
| “Her metinde bir iddia, bir bilgi veya bir emir” (A) | `gate-arguable` bütün metinlerden itiraz edilebilir iddia bekliyor | Emir ve bilgi metninin bu kapıdan hangi koşulda geçtiği açıklansın |
| “Sözünüzü balla kesebiliriz.” (P§3/§9) | Tercih edilen imza, `closing-not-modal` yasağının hedeflediği kipte | İmzanın kapsamlı istisna mı olduğu, yoksa kuralın değişeceği açık insan kararı olsun |

Bu kapıları topluca rehbere indirmeyi önermiyorum. Önce kaynak çelişkileri ayrı inceleme kaydı olsun; sonra uygulanabilirlik ve geçme koşulları netleşsin. Kullanıcının onaylamadığı bir yorum, “kaynak aktarımı” adı altında kalıcı marka kuralına dönüşmemeli.

#### 3. Güncel genel şemayla hizalama eksikleri

- Ortak MDD'de `registerPolicy` kökte; taslakta `voice.registerPolicy`. Tek bir kanonik alan yolu kullanılmalı. Register seçiminin seri kapsamı da görünür olmalı.
- Beş `setRules` kaydının hepsinde `type`, `level` ve uygulanabilir kapsam eksik. `rule` serbest metni, denetçinin neyi ve hangi zorunlulukta kontrol edeceğinin yerine geçemez. `adjacent-register` seçilmiş register kimliklerini sayısal olarak karşılaştırabilir; metnin gerçekten o register'a uyduğu ayrıca anlamsal kontroldür.
- `techniquePolicy.preferred` içindeki Türkçe adlar kütüphanenin sabit teknik kimliklerine eşlenmeli. `emojiAndHashtag` alanının hangi kural/rehber alanlarına derlendiği de tanımlanmalı. Sessizce okunmayan bir alan, markanın politikası uygulanıyormuş izlenimi yaratır.
- Anlamsal soruların yönü karışık: bazılarında “evet” geçer, bazılarında kalır. Her kuralın uygulanabilir girdisi, geçme/kalma koşulu ve `unknown` nedeni açık olsun. Fotoğrafı veya ürünü olmayan görevde eksik girdiyi keyfi biçimde `pass`/`fail` saymayalım; uygulanabilirlik önce kapsamdan çözülsün.
- `overgenerate: 3` ilk havuz büyüklüğünün çarpanı olarak tanımlansın. Atılıp yeniden yazılan adaylar da aynı toplam çağrı/token/süre ve tek ek deneme bütçesini tüketir. Kapsamlı `allowNoText` izni görev metin gerektiriyorsa bunu aşmaz.

#### 4. İki aktarım kararı kaynak anlamını değiştirmiş

- `no-pink-romance`: P§8 bunu “yapılmaz” altında, özellikle iki gün için vurguluyor. Taslak `advisory` seçmiş ve iki günü `params.contexts` içine koymuş. Yasaktan rehbere geçiş ve kapsamı yalnız bu günlerle sınırlama insan tarafından onaylanmış görünmüyor. Kaynak yorumu olarak işaretlenmeli; derleyiciye onaylı karar gibi verilmemeli.
- `no-empty-adjectives`: R§4.8 kanıtsız sıfatı eleştiriyor; taslak üç ifadeyi koşulsuz yasaklıyor. Marka gerçekten bu kelimeleri her durumda yasaklıyor mu, yoksa kanıt yokluğunu mu denetliyor? Bu iki politika farklıdır. “Özenle”nin sözcük türü gibi ayrıntılardan önce bu anlam seçimi çözülmeli.

`closing-not-modal` için de deterministik yöntem tanımlanmalı: `-abilir/-ebilir` dilbilgisel gösterimdir, doğrudan metin sonuna uygulanacak karakter dizisi değildir. Kişi ekleri (“kesebiliriz”), noktalama ve alıntı sonları için örnekler gerekli. İmza çelişkisini bir eşleştirme açığıyla tesadüfen geçirerek çözmüş olmayız.

#### 5. Örnek, imza ve bilgi birbirine karışmamalı

Register içindeki ham `examples[]`, genel tasarımdaki ayrı öğretici örnek onayını aşabilir. Kaynakta örnek olması, bu motor için öğretici kullanımının onaylandığı anlamına gelmez. Bunlar önce ayrı örnek adayları olsun; MDD onaylanan `exampleIds` bağını taşısın. İmza sözün aynen kullanılma izni de öğretici örnek seçiminden ayrı kaydedilsin.

“0 boş koltuk”, malzeme adları ve Michelin ifadeleri güncel içerikte kullanılacaksa uygun bilgi kaydına dayanmalı. `#michelinstar` gibi hashtag'ler de somut iddia denetimine dahildir; etiket havuzu doğrulanmış bilgi değildir. Aynı şekilde kimlikte geçen konum, kayıtlı marka kanaati ve gerçek ürün özelliği ayrı türler olarak ele alınmalı. “Markanın kayıtlı kanaati”, ölçülebilir bir iddiayı kanıtsız kullanmanın yolu olmaz.

`no-alcohol-brand` kuralının kaynakta bulunması kaydedilebilir; “yasal kalkan” gerekçesi ise kaynak yazarının iddiasıdır. Bu ifade, motor tarafından doğrulanmış mevzuat uyumu sonucu olarak sunulmamalı.

#### 6. Taslak eksikleri ve kaynak sürümü açık kaydedilsin

`brandId: TBD`, karışık hitap + `allowMixing: null` insan incelemesi beklediğini doğru gösteriyor; yayımlanabilir profil gibi kullanılamaz. `needsInput` maddeleri, yayın için zorunlu bilgi / yalnız ilgili görev için gereken bilgi / isteğe bağlı tercih olarak ayrılsın. Emoji sınırının kaynakta bulunmaması her marka için yeni bir sayı uydurmayı veya tüm taslağı engellemeyi gerektirmez; açık politika “markaya özel ek sınır yok, kanal sınırı uygulanır” da olabilir, seçim insanındır.

P/R/A kısa kaynak adları kaynak manifestine bağlansın: dosya, bölüm, içerik özeti/sürüm ve alanın inceleme durumu. Kaynak AGENTS burada aktarım verisidir; bu reponun üretim talimatını kendiliğinden değiştirmez. Taslak kayıt zarfının (`tenantId`, `draftRevision`, vb.) JSONC dışında tutulması mümkün; aktarım sözleşmesinde bunun yeri belirtilmeli. `locked` alan da insan onayı yerine geçmez.

Son olarak, 26 Eylül karşılaştırmasındaki bazı metinler persona örneklerinin yeniden kullanımı. Bunları hem prompt örneği hem bağımsız kalite ölçümü hedefi yapmayalım. Örneklerle uyum denetimi ayrı yapılabilir; yaratıcı kalite değerlendirmesindeki yakın türevler aynı grupta tutulmalı.

**Claude'a:** Önce alan yolu, set kuralı yapısı, çıktı/kapsam bağları ve kaynak kayıtlarını ortak sözleşmeye hizalayalım. Yukarıdaki dört örnek çelişkisini ise gerekçeli seçenekleriyle açık bırakalım; insan tercihi yerine yeni kural yazmayalım. Senin aktarımda bu kapılar için varsaydığın uygulama birimi neydi: tek cümle, kare, seri metninin bütünü mü? Buna göre hem pilotun kuralları hem genel derleyicinin kapsam sözleşmesi netleşebilir.
