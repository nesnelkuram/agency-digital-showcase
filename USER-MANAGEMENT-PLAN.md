# Kullanıcı Yönetimi Geliştirme Planı

> Mevcut RBAC altyapısı (`lib/rbac/`) üzerine inşa edilecek.
> Temel ilke: **Finansal veriler yalnızca yönetim görür. Kreatif ekip fiyat görmez.**

---

## Mevcut Durum

| Rol | Sorun |
|---|---|
| `super_admin` | ✅ Sorunsuz |
| `admin` | ✅ Sorunsuz |
| `staff` | ❌ Çok geniş — hem kreatif hem finans görüyor |
| `client` | ⚠️ Temel var ama portal eksik |
| `freelancer` | ⚠️ Var ama UI'da desteklenmiyor |

---

## Yeni Rol Yapısı

### İç Ekip (Ajans Çalışanları)

#### `admin` — Yönetici
- Her şeyi görür ve yönetir
- Fiyat, teklif, müşteri kartı, finans raporu dahil
- Kullanıcı davet eder, rol değiştirir

#### `account_manager` — Müşteri İlişkileri *(YENİ)*
- Müşteri portföyünü görür
- Teklifleri **görür** ama **düzenleyemez**
- Proje oluşturur, görev atar
- Sosyal medya planlarını onaylamak üzere müşteriye iletir
- **Finans detayını (maliyet, kar marjı) GÖRMEZ** — sadece teklif fiyatını görür

#### `editor` — Kreatif / İçerik Editörü *(YENİ)*
- Sosyal medya içerikleri oluşturur ve düzenler
- Assets, geri bildirim, onay süreçlerine erişir
- Kendi atandığı projeleri görür
- **Fiyatlandırma, teklif, finans modüllerini GÖRMEZ**
- Tüm pricing route'ları ve nav itemları gizlenir

#### `staff` — Genel Personel *(Daraltılacak)*
- Mevcut `staff` rolü ikiye bölünecek: `account_manager` + `editor`
- Geriye kalan `staff` → sadece proje ve görev yönetimi

### Dış Kullanıcılar

#### `client` — Müşteri *(Güçlendirilecek)*
- Kendi projesine ait içerikleri görür
- Sosyal medya planlarını onaylar / reddeder / yorum yapar
- Geribildirim verir
- Teklif PDF'ini görür (maliyet detayı olmadan, sadece toplam fiyat)
- **Ayrı bir portal üzerinden giriş yapar** (admin panel değil)

#### `freelancer` — Freelancer
- Atandığı görevleri görür
- Dosya yükler, onaya sunar
- Eğitim materyallerine erişir

---

## Finansal Veri Erişim Matrisi

| Modül | super_admin | admin | account_manager | editor | client | freelancer |
|---|:---:|:---:|:---:|:---:|:---:|:---:|
| Teklif fiyatı (toplam) | ✅ | ✅ | ✅ | ❌ | ✅* | ❌ |
| Maliyet detayı (iş gücü, ekipman) | ✅ | ✅ | ❌ | ❌ | ❌ | ❌ |
| Kar marjı | ✅ | ✅ | ❌ | ❌ | ❌ | ❌ |
| Hizmet katalogu fiyatları | ✅ | ✅ | görünür* | ❌ | ❌ | ❌ |
| Personel maliyetleri | ✅ | ✅ | ❌ | ❌ | ❌ | ❌ |
| Finansal projeksiyon | ✅ | ✅ | ❌ | ❌ | ❌ | ❌ |

*`account_manager` katalogda sadece satış fiyatını görür, maliyet ve marj kolonları gizlenir
*`client` sadece kendine gönderilen teklif PDF'ini görür

---

## Yapılacak İşler

### 1. Yeni Roller — `lib/rbac/roles.ts`

`editor` ve `account_manager` rolleri eklenecek.

**`editor` permissions:**
- `projects:view_own`, `projects:edit`
- `tasks:view`, `tasks:edit`, `tasks:create`
- `approvals:*`, `assets:*`, `feedback:*`
- `social_media:*`
- `filing:view`, `filing:create`
- `training:view`, `training:complete`

**`account_manager` permissions:**
- `editor`'ın her şeyi +
- `projects:create`, `projects:archive`
- `leads:view`, `leads:assign`
- `marketing:view`, `marketing:create`
- `workflows:view`, `workflow_instances:*`
- `users:view`

**`staff` güncellenecek:** `MARKETING_BUDGET` ve pricing permission'ları kaldırılacak.

---

### 2. Yeni Permissions — `lib/rbac/permissions.ts`

```
PRICING_VIEW_COST:    'pricing:view_cost'      // maliyet detayı
PRICING_VIEW_MARGIN:  'pricing:view_margin'    // kar marjı
PRICING_VIEW_PRICE:   'pricing:view_price'     // sadece satış fiyatı
PRICING_EDIT:         'pricing:edit'
```

Mevcut teklif ve katalog sayfalarında bu permission'lara göre kolonlar/alanlar gösterilip gizlenecek.

---

### 3. UI Guard'lar

**Sidebar:**
- `editor` ve `client` rollerinde şu nav itemları tamamen kaldırılır:
  - Finansal Yönetim
  - Hizmet Katalogu
  - Teklif Dokümanları
  - Fiyat Teklifi

**Katalog sayfası (`CatalogPage`):**
- `account_manager` için maliyet detay kolonları (`employeeLaborCost`, `margin`, `ownerLaborCost`) gizlenir
- Sadece `suggestedPrice` gösterilir

**Teklif detay (`ProposalViewPage`):**
- `account_manager` için breakdown tablosu gizlenir, sadece toplam fiyat görünür

---

### 4. Kullanıcı Yönetim Ekranı — `admin/settings/UserManagementPage.tsx`

Mevcut sayfa var ama geliştirilmesi gerekiyor:

- [ ] Kullanıcı listesi: avatar, ad, rol, son giriş, durum (aktif/pasif)
- [ ] Rol değiştirme (dropdown ile anında)
- [ ] Kullanıcı davet etme (email + rol seçerek)
- [ ] Davet linki kopyalama
- [ ] Kullanıcıyı askıya alma / devre dışı bırakma
- [ ] Kullanıcı bazlı proje ataması
- [ ] Rol bazlı filtre

---

### 5. Davet Sistemi

**Flow:**
1. Admin → "Kullanıcı Davet Et" → email + rol seçer
2. Firestore'a `invitations` koleksiyonuna kayıt atılır
3. Email gönderilir (token içeren link)
4. Kullanıcı linke tıklar → şifre oluşturur → hesap aktif olur
5. `tenantId` otomatik atanır, rol set edilir

**Firestore:**
```
invitations/{token}
  email: string
  role: RoleName
  tenantId: string
  invitedBy: string
  createdAt: Timestamp
  expiresAt: Timestamp  // 7 gün
  status: 'pending' | 'accepted' | 'expired'
```

---

### 6. Müşteri Portalı (Yeni Sayfa)

Mevcut admin panel müşteri için uygun değil. Ayrı bir portal route açılacak:

**Route:** `/portal` (AdminLayout dışında, ayrı layout)

**Sayfalar:**
- `/portal` — Müşteri dashboard (aktif projeler)
- `/portal/projects/:id` — Proje detayı
- `/portal/approvals` — Onay bekleyenler
- `/portal/social-media` — İçerik planları (onay ekranı)
- `/portal/feedback` — Geri bildirimler

**Özellikler:**
- Sade, temiz UI — admin panel karmaşıklığı yok
- Finansal hiçbir şey görünmez
- Türkçe, müşteri dostu dil
- Mobil uyumlu (müşteriler telefonda onay verir)

---

### 7. Rol Bazlı Dashboard

Giriş yapıldığında rol'e göre farklı dashboard gösterilecek:

| Rol | Dashboard İçeriği |
|---|---|
| `admin` | Tüm metrikler: gelir, teklif, proje sayısı, ekip durumu |
| `account_manager` | Müşteri portföyü, bekleyen onaylar, aktif projeler |
| `editor` | Atanan görevler, onay bekleyenler, sosyal medya takvimi |
| `client` | Sadece kendi projeleri, onay bekleyen içerikler |
| `freelancer` | Atanan görevler, teslim tarihleri |

---

## Uygulama Önceliği

| Adım | İş | Zorluk | Süre |
|---|---|---|---|
| 1 | `editor` ve `account_manager` rolleri + permissions | Kolay | 1 gün |
| 2 | Sidebar finansal itemları rol bazlı gizleme | Kolay | 2 saat |
| 3 | Katalog ve teklif sayfasında maliyet kolonlarını gizleme | Orta | 1 gün |
| 4 | UserManagementPage geliştirme | Orta | 2 gün |
| 5 | Davet sistemi (email + token) | Orta | 2 gün |
| 6 | Rol bazlı dashboard | Orta | 2 gün |
| 7 | Müşteri portalı | Zor | 4-5 gün |

**Toplam:** ~2 hafta (öncelik sırasına göre kademeli yapılabilir)

---

## Kritik Kural

> Finansal verilerin gizlenmesi sadece UI seviyesinde değil,
> **Firestore rules ve API seviyesinde** de uygulanmalı.
> Sidebar'dan kaldırmak yeterli değil — doğrudan URL'e gidilirse de engellenmelİ.

Bunun için:
- Firestore Security Rules'da `pricing` koleksiyonuna rol bazlı erişim kısıtı
- API endpoint'lerinde `withAuth` middleware'ine rol kontrolü eklenmeli
