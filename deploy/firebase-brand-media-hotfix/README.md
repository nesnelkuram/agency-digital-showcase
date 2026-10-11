# Firebase hotfix — Studio medya kütüphanesi yükleme + listeleme

Hazırlık: 2026-10-09 · **DEPLOY EDİLMEDİ** (işlem anı onayı bekleniyor) · Proje: `intiba-ab4bd`

## Sorun
Studio medya kütüphanesinde yükleme `403` (Storage `brand-media/...` isteği). Canlı Storage ve Firestore kurallarında
`brand-media` / `brand_media` blokları yok; Vercel'deki yeni arayüz bu yolları kullanıyor.

## Taban (canlı) — birebir doğrulandı
| Dosya | Karakter | Satır | FNV-1a64 | Kaynak |
|---|---|---|---|---|
| storage.rules | 8014 | 193 | `299f43c968029ed8` | `git show 987ed92:storage.rules` |
| firestore.rules | 41080 | 886 | `a6d54c361ba007a1` | `git show 987ed92:firestore.rules` |
Konsoldaki canlı metinle (kullanıcı ölçümü) ve yerel hesapla aynı.

## Bu klasördeki dosyalar
- `firestore.rules` — canlı taban + yalnız `match /brand_media/{assetId}` bloğu (72 satır ekleme, silme yok). Fark: `firestore.rules.diff`
- `storage.rules` — canlı taban + `canUseBrandLibrary()` + `match /brand-media/...` bloğu (33 satır ekleme, silme yok). Fark: `storage.rules.diff`
- `firestore.indexes.json` — **canlıdaki 133 indeksin birebir kopyası + 2 yeni** (silinecek aday: 0):
  - `brand_media (tenantId, projectId, status, createdAt desc)` — kütüphane listesi (zorunlu)
  - `social_media_posts (tenantId, projectId, libraryAssetIds CONTAINS)` — kullanım bilgisi (yoksa arayüz "bilinmiyor" der)
- `live-indexes.snapshot.json` — `firebase firestore:indexes --project intiba-ab4bd` çıktısı (salt okunur, 2026-10-09)
- `firebase.json` — yalnız bu klasördeki dosyalara işaret eder

Dağıtılmayanlar (HEAD'de var, bilerek dışarıda): post `libraryAssetIds`/zaman kilidi/super_admin korumaları, plan super_admin koruması, `brand_media` etiket indeksi, HEAD indeks dosyasının geri kalanı.

Erişim (değişmeyen tasarım): aynı tenant + (`super_admin|admin|account_manager|staff|editor` veya atanmış `brand_manager`) + proje var ve aynı tenant'a ait. Freelancer, müşteri, anonim, başka tenant: red. Public erişim veya genel admin bypass yok. Silme yok, write-once.

IAM: yeni izin gerekmez. Canlı Storage kuralları zaten `firestore.get()` (cross-service) kullanıyor; ek okuma aynı yetkiyle (istek başına kullanıcı + proje = 2 doküman).

## Test kanıtı (yerel emülatör, demo-* projeler)
- `tests/rules/brandMediaHotfix.rules.test.ts` bu klasördeki dosyalara karşı: **8/8** (admin 1,2 MB `2.png` yükleme → `getDownloadURL` → katalog kaydı → listeleme; atanmış brand_manager; başka tenant admini, atanmamış brand_manager, müşteri, freelancer, anonim için yükleme/okuma/URL/kayıt/liste reddi; başka tenant/var olmayan proje; üzerine yazma/silme yok; tür ve 1_000_000_000 bayt sınırı)
- Canlı tabanın kendi testleri (`987ed92:tests/rules/*`) bu dosyalara karşı: firestore **33/33**, storage **10/10** (emülatör proje kimliği eşleştirilerek; eşleşmezse taban kurallarında da aynı 4 test ortam nedeniyle düşüyor — kontrol koşusuyla doğrulandı)

## Onay sonrası komutlar (depo kökünden)
```bash
# 1) Doğrulama (değişiklik yapmaz)
firebase deploy --dry-run --non-interactive --project intiba-ab4bd \
  --config deploy/firebase-brand-media-hotfix/firebase.json \
  --only firestore:rules,firestore:indexes,storage

# 2) Uygulama — --force YOK; indeks dosyası canlıyı kapsadığı için silme önerisi doğmaz
firebase deploy --non-interactive --project intiba-ab4bd \
  --config deploy/firebase-brand-media-hotfix/firebase.json \
  --only firestore:rules,firestore:indexes,storage
```
Not: `brand_media` indeksi boş koleksiyonda hızlı; `social_media_posts` indeksi mevcut post sayısına göre birkaç dakika sürebilir (konsoldan "Building/Enabled").

## Geri dönüş
Kurallar: taban dosyalarıyla (`git show 987ed92:firestore.rules` / `storage.rules`) aynı `--only firestore:rules,storage` komutu. İndeksler eklemeli olduğu için geri almak gerekmez (silme ayrı onay ister).
