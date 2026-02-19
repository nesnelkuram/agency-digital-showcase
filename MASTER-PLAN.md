# intiba Admin Panel — Master Geliştirme Planı

> Tarih: 2026-02-18
> Temel: Tüm kaynak kodu analiz edilerek hazırlandı.
> Bu belge, sistemin gerçek durumunu ve yapılması zorunlu olan her şeyi kapsar.

---

## Mevcut Durum Özeti

| Modül | Durum |
|---|---|
| Lead Yönetimi | ✅ Tam çalışır |
| Proje Yönetimi | ✅ Tam çalışır |
| Workflow Sistemi | ✅ Tam çalışır |
| Social Media | ✅ Tam çalışır |
| Marketing | ✅ Büyük ölçüde çalışır |
| Fiyatlandırma | ✅ Büyük ölçüde çalışır |
| Feedback | ✅ Tam çalışır |
| Dosyalama | ✅ Çalışır |
| Multi-tenant (Faz 1-4) | ✅ Tamamlandı |
| **Bildirim Sistemi** | ❌ Tamamen yok (dekoratif ikon) |
| **Müşteri Portalı** | ❌ Hiç yazılmamış |
| **Davet Email + Kabul** | ❌ TODO olarak bırakılmış |
| **Profil Düzenle** | ❌ Route tanımlanmamış |
| **Asset Kütüphanesi** | ❌ Placeholder |
| **Dashboard Gerçek Veri** | ❌ Hardcoded mock |
| **Editor/Account Manager rolleri** | ❌ Planlandı, yazılmadı |
| **Eğitim Modülü** | ⚠️ Mock data |
| **Ayarlar (eksik sayfalar)** | ⚠️ 3 route eksik |

---

---

# BÖLÜM 1 — KULLANICI YÖNETİMİ VE YETKİLENDİRME

## 1.1 Rol Yapısı Yeniden Tasarımı

### Mevcut Roller (sorunlu)
`staff` rolü çok geniş — hem finansalı hem kreatifleri kapsıyor. Kimsenin görmemesi gereken şeyleri gösteriyor.

### Yeni Rol Yapısı

```
super_admin       Tüm tenant'lar, global erişim
    │
admin             Tek tenant, tüm erişim (finans dahil)
    │
account_manager   Müşteri ilişkileri — finans detayı GÖRMEz
    │
editor            Kreatif ekip — fiyat modüllerini GÖRMEZ
    │
freelancer        Sadece atandığı görevler
    │
client            Kendi projesi — sadece içerik onayı, fiyat detayı YOK
```

---

### `account_manager` Rolü (YENİ)

**Kimdir:** Müşteriyle birebir çalışan, proje koordinatörü.

**Görebileceği:**
- Tüm projeler (oluşturma dahil)
- Lead'ler (görüntüleme + atama)
- Sosyal medya planları (oluşturma + müşteriye iletme)
- Marketing (kampanya görüntüleme, teklif görüntüleme)
- Hizmet kataloğu — sadece **satış fiyatı** (maliyet, kar marjı GİZLİ)
- Teklif dokümanları — sadece **toplam tutar** (breakdown GİZLİ)
- Feedback, Assets, Onaylar, Workflows, Filing

**Göremeyeceği:**
- Maliyet kırılımı (iş gücü, ekipman maliyeti)
- Kar marjı yüzdesi
- Personel maliyetleri
- Finansal projeksiyon sayfaları
- Sabit gider yönetimi

---

### `editor` Rolü (YENİ)

**Kimdir:** İçerik üretici, tasarımcı, kameraman.

**Görebileceği:**
- Kendi atandığı projeler
- Görevler (oluşturma + düzenleme)
- Sosyal medya içerikleri (oluşturma + düzenleme)
- Assets (yükleme + indirme)
- Feedback (görüntüleme + yorum)
- Onaylar (görüntüleme + sunma)
- Filing (görüntüleme + dosya ekleme)
- Eğitim

**Göremeyeceği:**
- Fiyatlandırma modülleri (tümü)
- Lead listesi
- Marketing kampanyaları
- Kullanıcı yönetimi
- Ayarlar
- Workflow oluşturma/düzenleme

---

### `client` Rolü (Güçlendirilecek)

**Kimdir:** Ajans müşterisi — dışarıdan sisteme bağlanıyor.

**Önemli:** Client, admin paneli kullanmaz. **Ayrı portal üzerinden giriş yapar** (Bölüm 3).

**Görebileceği (portalda):**
- Kendi projeleri
- İçerik planları → onay/red/yorum
- Geribildirimler
- Teklif toplam tutarı (PDF formatında, maliyet detayı olmadan)
- Onay bekleyen içerikler

**Kesinlikle göremeyeceği:**
- Admin panel
- Diğer müşterilerin projeleri
- Herhangi bir finansal detay

---

### Finansal Veri Erişim Matrisi

| Alan | super_admin | admin | account_manager | editor | client | freelancer |
|---|:---:|:---:|:---:|:---:|:---:|:---:|
| Satış fiyatı | ✅ | ✅ | ✅ | ❌ | ✅* | ❌ |
| İş gücü maliyeti | ✅ | ✅ | ❌ | ❌ | ❌ | ❌ |
| Ekipman maliyeti | ✅ | ✅ | ❌ | ❌ | ❌ | ❌ |
| Kar marjı | ✅ | ✅ | ❌ | ❌ | ❌ | ❌ |
| Personel ücretleri | ✅ | ✅ | ❌ | ❌ | ❌ | ❌ |
| Sabit giderler | ✅ | ✅ | ❌ | ❌ | ❌ | ❌ |
| Finansal projeksiyon | ✅ | ✅ | ❌ | ❌ | ❌ | ❌ |

*client yalnızca kendine özel gönderilen teklif PDF'ini görür

---

## 1.2 Yeni Permissions

`lib/rbac/permissions.ts` dosyasına eklenecekler:

```typescript
// Pricing erişim seviyeleri (ayrıştırılmış)
PRICING_VIEW_PRICE:    'pricing:view_price'     // sadece satış fiyatı
PRICING_VIEW_COST:     'pricing:view_cost'      // maliyet detayı
PRICING_VIEW_MARGIN:   'pricing:view_margin'    // kar marjı
PRICING_VIEW_STAFF:    'pricing:view_staff'     // personel ücretleri
PRICING_VIEW_FIXED:    'pricing:view_fixed'     // sabit giderler
PRICING_FULL:          'pricing:full'           // tam erişim
```

---

## 1.3 UI Seviyesinde Gizleme

### Sidebar (AdminLayout.tsx)

`editor` ve `client` rollerinde şu nav itemları kaldırılır:
- Finansal Yönetim (ve tüm alt menüsü)
- Hizmet Kataloğu
- Teklif Dokümanları
- Fiyat Teklifi

`editor` rolünde ayrıca kaldırılır:
- Başvurular (Leads)
- Ayarlar

### Katalog Sayfası (CatalogPage)

`account_manager` için gizlenen kolonlar:
- `employeeLaborCost` (İş gücü)
- `ownerLaborCost` (Sahip payı)
- `margin` (Marj yüzdesi)
- `profit` (Kâr)

Görünen tek finansal veri: `suggestedPrice` (Satış fiyatı)

### Teklif Detay (ProposalViewPage)

`account_manager` için gizlenen bölümler:
- Maliyet kırılımı tablosu
- Kar marjı hesabı
- İş gücü/ekipman alt detayları

---

## 1.4 API + Firestore Seviyesinde Güvenlik

> UI'dan gizlemek yeterli değil. Doğrudan URL yazılırsa da engellenmeli.

### API Endpoints

`withAuth` middleware'ine rol kontrolü:

```typescript
// Örnek: maliyet endpoint'i
export default withAuth(handler, {
  requiredPermissions: ['pricing:view_cost']
});
```

### Firestore Security Rules

`pricing` koleksiyonu için rol bazlı okuma kısıtı:

```
match /pricing/{tenantId}/data/{document=**} {
  allow read: if hasPermission('pricing:view_cost');
}
```

---

## 1.5 Kullanıcı Yönetim Ekranı Geliştirmesi

### Mevcut: Kısmen çalışıyor

Eksikler:
- Davet email'i gönderilmiyor (`// TODO` var)
- Davet kabul sayfası yok
- Profil düzenleme route'u yok
- Rol bazlı filtre yok
- Son giriş tarihi gösterilmiyor

### Hedef Ekran Özellikleri

**Kullanıcı Listesi:**
- Avatar (baş harf veya fotoğraf)
- Ad Soyad
- Email
- Rol (dropdown ile anında değiştirilebilir)
- Son giriş tarihi
- Durum: Aktif / Askıda / Davet bekliyor
- Atanmış proje sayısı

**Filtreler:**
- Rol bazlı filtre (tümü / admin / account_manager / editor / client / freelancer)
- Durum filtresi (aktif / pasif / davet bekliyor)
- Arama (ad veya email)

**Aksiyonlar:**
- Kullanıcı davet et (modal)
- Rol değiştir
- Askıya al / Aktifleştir
- Hesabı sil (admin onayı gerektirir)
- Projeye ata (modal ile)

---

## 1.6 Davet Sistemi (Tamamen Yeniden Yazılacak)

### Mevcut: Kırık (TODO)

Firestore'a kayıt atıyor ama email gitmiyor, kabul sayfası yok.

### Hedef Flow

```
Admin "Davet Et" → email + rol seçer
        ↓
Firestore invitations/{token} kaydı
        ↓
Resend API ile email gönderilir
        ↓
Kullanıcı linke tıklar → /join?token=xxx
        ↓
Token doğrulama (süresi dolmuş mu?)
        ↓
Şifre belirleme formu
        ↓
Firebase Auth hesabı oluşturulur
        ↓
Firestore users/{uid} yazılır (tenantId + rol ile)
        ↓
/admin'e yönlendirilir
```

### Firestore Şeması

```
invitations/{token}
  email:       string
  role:        RoleName
  tenantId:    string
  invitedBy:   string (uid)
  createdAt:   Timestamp
  expiresAt:   Timestamp  // +7 gün
  status:      'pending' | 'accepted' | 'expired'
  acceptedAt?: Timestamp
  acceptedBy?: string (uid)
```

### Yeni Sayfalar

- `/join` — Davet kabul sayfası (AdminLayout dışında, ayrı route)
- `/join?token=xxx` → token doğrula → şifre belirle → hesap oluştur

### Email Şablonu (Resend)

Gönderilecek email içeriği:
- Ajans adı
- "Sizi davet etti" mesajı
- Rol bilgisi
- "Hesabı Oluştur" butonu (link)
- 7 gün geçerlilik uyarısı

---

## 1.7 Profil Sayfası (Eksik Route)

`/admin/settings/profile` route'u `AdminApp.tsx`'de yok.

### Içerik:
- Ad Soyad düzenleme
- Profil fotoğrafı yükleme (Firebase Storage)
- Şifre değiştirme (re-authentication gerektirir)
- Email değiştirme (doğrulama emaili gönderilir)
- Bildirim tercihleri

---

---

# BÖLÜM 2 — BİLDİRİM SİSTEMİ

## 2.1 Mevcut Durum

`AdminLayout.tsx`'de Bell ikonu var, kırmızı nokta her zaman gösteriyor.
**Tıklayınca hiçbir şey olmuyor.** Tamamen dekoratif.

`/admin/settings/notifications` route'u `AdminApp.tsx`'de tanımlı değil → 404.

## 2.2 Firestore Şeması

```
notifications/{notificationId}
  tenantId:    string
  recipientId: string (uid)
  type:        NotificationType
  title:       string
  body:        string
  link?:       string  // tıklayınca nereye gitsin
  read:        boolean
  createdAt:   Timestamp
  readAt?:     Timestamp
  metadata?:   Record<string, any>  // ekstra veri
```

### Bildirim Tipleri (NotificationType)

```typescript
type NotificationType =
  | 'approval_needed'        // Onay bekleyen içerik var
  | 'approval_completed'     // İçerik onaylandı/reddedildi
  | 'comment_added'          // Yorum yapıldı
  | 'task_assigned'          // Görev atandı
  | 'task_completed'         // Görev tamamlandı
  | 'workflow_step_ready'    // Workflow adımı sıra sende
  | 'workflow_completed'     // Workflow tamamlandı
  | 'lead_assigned'          // Lead atandı
  | 'social_plan_approved'   // İçerik planı onaylandı
  | 'social_plan_rejected'   // İçerik planı reddedildi
  | 'project_created'        // Yeni proje oluşturuldu
  | 'mention'                // @mention yapıldı
  | 'system'                 // Sistem bildirimi
```

## 2.3 useNotifications Hook

```typescript
// shared/hooks/useNotifications.ts
const { notifications, unreadCount, markAsRead, markAllAsRead } = useNotifications();
```

Firestore real-time listener ile çalışır (`onSnapshot`).

## 2.4 Bildirim Paneli (UI)

Bell ikonuna tıklayınca açılan dropdown:
- "Tüm Bildirimler" başlığı + "Tümünü okundu işaretle"
- Bildirim listesi (son 20)
  - İkon (tipe göre farklı)
  - Başlık + kısa açıklama
  - Zaman (3 dakika önce, 1 saat önce)
  - Okunmamışsa mavi nokta
  - Tıklayınca ilgili sayfaya yönlendirme
- "Tüm bildirimleri gör" linki → `/admin/notifications`

## 2.5 Bildirim Ayarları Sayfası

`/admin/settings/notifications` route'u eklenecek.

İçerik:
- Her bildirim tipi için açma/kapama toggle'ları
- "Email bildirimi de al" seçeneği (her tip için ayrı)
- Ayarlar Firestore `users/{uid}.settings.notifications` alanına kaydedilir

## 2.6 Bildirimi Kim Tetikler?

Her ilgili servis fonksiyonuna bildirim oluşturma eklenir:

| Olay | Tetikleyen Yer | Alıcı |
|---|---|---|
| Onay gönderildi | `approvalsService.submit()` | Proje yöneticisi |
| Onay yapıldı (client) | Public approval endpoint | İçerik oluşturucu + account_manager |
| Yorum eklendi | `feedbackService.addComment()` | İlgili kişiler |
| Görev atandı | `projectService.assignTask()` | Atanan kişi |
| Workflow adımı sıra geldi | `workflowEngineService` | Atanan kişi |
| Sosyal medya planı onaylandı | Share page endpoint | Account manager + editor |

---

---

# BÖLÜM 3 — MÜŞTERİ PORTALI

## 3.1 Neden Ayrı Portal?

Müşteriler (client rolü) şu an admin panele giriyor. Bu:
- Karmaşık ve korkutucu bir arayüz
- Gizli kalması gereken şeylerin görünme riski
- Yanlış sayfaya gitme ihtimali
- Güven sorununa yol açar

## 3.2 Portal Mimarisi

`/portal` route'u — AdminLayout **dışında**, tamamen farklı bir layout.

### Route Yapısı

```
/portal                          → Müşteri dashboard
/portal/projects                 → Projeleri
/portal/projects/:id             → Proje detayı
/portal/approvals                → Onay bekleyenler
/portal/social-media             → İçerik planları
/portal/social-media/:planId     → Plan detayı + onay
/portal/feedback                 → Geribildirimler
/portal/profile                  → Profil
```

### Giriş Yönlendirmesi

Firebase Auth giriş sonrası rol kontrolü:
```
admin/staff/account_manager/editor → /admin
client                             → /portal
freelancer                         → /admin (sınırlı görünüm)
```

## 3.3 Portal Dashboard

Sade, müşteri dostu tasarım:

```
┌─────────────────────────────────────────────┐
│  Merhaba, [Ad]  👋                          │
│                                             │
│  ┌─────────────┐  ┌─────────────┐           │
│  │ 2           │  │ 5           │           │
│  │ Aktif Proje │  │ Onay Bekl. │           │
│  └─────────────┘  └─────────────┘           │
│                                             │
│  Son Aktiviteler                            │
│  ○ "Mayıs İçerik Planı" onay bekliyor      │
│  ○ Projeye yeni dosya eklendi               │
│  ○ [Proje Adı] tamamlandı                  │
└─────────────────────────────────────────────┘
```

## 3.4 İçerik Onay Ekranı (Güçlendirilecek)

Mevcut share page (`/icerik-plani/:shareToken`) temel seviyede çalışıyor.
Portal versiyonu çok daha zengin olacak:

**Müşteri şunları yapabilecek:**
- Her postu ayrı ayrı onayla / reddet
- Yorum yaz (post bazında veya genel)
- Belirli bir alanı işaretle "bu görseli değiştir"
- Tüm planı toplu onayla
- Revizyon iste (metin açıklamasıyla)

**Ajans görecek:**
- Onay durumu gerçek zamanlı güncellenecek
- Müşterinin yazdığı yorumlar notification olarak gelecek
- Hangi postun onaylandığı, hangisinin revize istediği

## 3.5 Portal Tasarım Prensipleri

- Türkçe, sade dil
- Mobil öncelikli (müşteriler telefonda onay verir)
- AdminLayout karmaşıklığı yok — minimal sidebar veya top nav
- Ajansın brand renkleri ile özelleştirilebilir (tenant settings'den)
- Herhangi bir fiyat, maliyet, iç metrik gösterilmez

---

---

# BÖLÜM 4 — EKSİK SAYFALAR VE ROUTE'LAR

## 4.1 Asset Kütüphanesi

### Mevcut: Placeholder

```tsx
// AssetLibraryPage.tsx - gerçek içerik:
"Bu modül yakın zamanda aktif olacak."
```

`useAssetManagement` hook'u, `shared/types/asset.ts`, Firestore rules hazır. Sadece sayfa yazılmamış.

### Olması Gereken

**Sol panel:** Klasör ağacı (drag & drop ile sıralama)
**Ana panel:** Grid / liste görünümü toggle

**Özellikler:**
- Sürükle bırak yükleme
- Toplu yükleme
- Dosya türü filtresi (görsel / video / belge / font)
- Arama
- Etiket sistemi
- Kopyala link
- Versiyonlama (aynı dosyanın farklı versiyonları)
- Brand kit ayrımı (marka renkler, fontlar, logolar ayrı sekme)

**Firestore:**
```
assets/{tenantId}/files/{assetId}
  name:      string
  url:       string
  type:      'image' | 'video' | 'document' | 'font'
  folderId:  string
  size:      number
  tags:      string[]
  uploadedBy: string
  tenantId:  string
  createdAt: Timestamp
```

---

## 4.2 Dashboard Gerçek Veri

### Mevcut: Hardcoded

```tsx
{ label: 'Aktif Projeler', value: '12', change: '+2' }  // sabit sayı!
```

`useDashboardStats` hook'u yazılmış ama Dashboard bu hook'u kullanmıyor.

### Rol Bazlı Dashboard İçeriği

**admin / account_manager:**
```
┌─────────────┬─────────────┬─────────────┬─────────────┐
│ Bu Ay Gelir │ Aktif Proje │ Bekl. Onay  │ Açık Lead  │
│ 48.500 TL   │     12      │      5      │     8       │
└─────────────┴─────────────┴─────────────┴─────────────┘
Son aktiviteler — Yaklaşan teslim tarihleri — Ekip yükü
```

**editor:**
```
┌─────────────┬─────────────┬─────────────┐
│ Atanan Görev│ Bekl. Onay  │ Bu Hafta    │
│      7      │      2      │  3 teslim   │
└─────────────┴─────────────┴─────────────┘
Sosyal medya takvimi — Atanan görevler listesi
```

**client (portal):**
```
Aktif projelerim — Onay bekleyenler — Son aktivite
```

---

## 4.3 Eğitim Modülü Firestore Entegrasyonu

### Mevcut: Mock Data

```typescript
const mockResources = [
  { id: '1', title: 'Canva Kullanımı', ... }  // hardcoded
];
```

`SOP_CREATE`, `SOP_EDIT` permission'ları tanımlı ama admin için içerik ekleme sayfası yok.

### Olması Gereken

**Admin görünümü:**
- Eğitim materyali oluştur / düzenle / sil
- Kategorize et (video / döküman / quiz)
- Kime görünsün (tüm ekip / sadece editor / vb.)
- Tamamlanma durumu raporları

**Çalışan görünümü:**
- Materyal listesi (tamamlanan / tamamlanmayan)
- Video izle, döküman oku
- "Tamamladım" işaretle
- İlerleme yüzdesi

---

## 4.4 Eksik Route'lar

`AdminApp.tsx`'e eklenecekler:

```
/admin/settings/profile        → Profil düzenle
/admin/settings/notifications  → Bildirim ayarları
/admin/settings/integrations   → Entegrasyon yönetimi
/admin/notifications           → Tüm bildirimler listesi
/join                          → Davet kabul sayfası (AdminLayout dışında)
/portal/*                      → Müşteri portalı (AdminLayout dışında)
```

---

---

# BÖLÜM 5 — EMAİL SİSTEMİ

## 5.1 Mevcut Durum

Resend entegrasyonu var ama sınırlı kullanılıyor:
- `api/send-report.ts` ✅
- `api/send-feedback-notification.ts` ✅
- Davet email'i ❌ (TODO)
- Diğer transactional email'ler ❌

## 5.2 Gönderilmesi Gereken Email'ler

| Olay | Alıcı | Içerik |
|---|---|---|
| Kullanıcı daveti | Davet edilen | Giriş linki, rol, ajans adı |
| Şifre sıfırlama | Kullanıcı | Firebase default veya custom |
| Proje oluşturuldu | Client + ilgili staff | Proje özeti |
| Onay talebi | Client | İçerik planı linki |
| İçerik onaylandı | Editor + account_manager | Kim onayladı, hangi plan |
| İçerik reddedildi | Editor + account_manager | Red sebebi |
| Workflow adım tamamlandı | Sonraki adım sahibi | Görev detayı |
| Haftalık özet | admin + account_manager | Proje durumları (cron) |

## 5.3 Email Şablonları

Resend ile React Email şablonları oluşturulacak:

```
api/emails/
  InvitationEmail.tsx
  ApprovalRequestEmail.tsx
  ApprovalResultEmail.tsx
  WorkflowStepEmail.tsx
  WeeklySummaryEmail.tsx
```

---

---

# BÖLÜM 6 — GÜVENLİK VE ALTYAPI

## 6.1 Firebase Auth Custom Claims

### Mevcut Sorun

`firestore.rules`'da her kural değerlendirmesinde `getUserTenantId()` fonksiyonu ekstra Firestore okuma yapıyor. Yük altında yavaşlatır ve maliyet artırır.

### Çözüm: Custom Claims

Firebase Auth token'ına `tenantId` ve `role` yazılacak:

```javascript
// Firebase Admin ile
await admin.auth().setCustomUserClaims(uid, {
  tenantId: 'tenant_abc',
  role: 'editor'
});
```

Firestore rules bunu okuyabilir, ekstra sorgu gerekmez:
```
function getUserRole() {
  return request.auth.token.role;
}
function getUserTenantId() {
  return request.auth.token.tenantId;
}
```

**Etkilenen:** `lib/firebase/apiClient.ts`, `api/_lib/withAuth.ts`, Firestore rules

## 6.2 Firebase Storage Tenant İzolasyonu

`storage.rules` incelenmeli. Mevcut durumda diğer tenant'ların dosyalarına erişim mümkün olabilir.

Hedef path yapısı:
```
storage/{tenantId}/assets/{assetId}
storage/{tenantId}/feedback-videos/{videoId}
storage/{tenantId}/social-media/{postId}/{mediaFile}
```

Storage rules:
```
match /b/{bucket}/o/{tenantId}/{allPaths=**} {
  allow read, write: if request.auth.token.tenantId == tenantId;
}
```

## 6.3 Firestore Composite Index'ler

Multi-tenant sorguları genellikle `where('tenantId', '==', x).where('status', '==', y).orderBy('createdAt')` gibi üçlü sorgular kullanıyor.

Bu tür her sorgu için `firestore.indexes.json`'a composite index eklenmeli. Tahminen 20-30 index gerekiyor. Eksik index production'da query hataları üretiyor.

## 6.4 Rate Limiting

API endpoint'lerine rate limiting yok. Özellikle AI endpoint'leri (`generate-caption`, `analyze-brand` vb.) kötüye kullanıma açık.

Vercel'de middleware ile basit rate limiting:
```typescript
// api/_lib/rateLimit.ts
export function rateLimit(identifier: string, limit: number, window: number)
```

Veya Upstash Redis ile daha sağlam bir çözüm.

---

---

# BÖLÜM 7 — SOSYAL MEDYA MODÜLü GELİŞTİRMELERİ

Ayrı bir öneriler dokümanı (`USER-MANAGEMENT-PLAN.md`) mevcut. Burada teknik özet:

## 7.1 Post Oluşturma UX

Mevcut 6 adımlı wizard → Tek ekran form + canlı önizleme

```
Sol (60%)              Sağ (40%)
─────────────────      ─────────────────
Platform seç           [Canlı Önizleme]
Post tipi seç          Instagram Feed /
Medya yükle            Story / TikTok /
Caption yaz            LinkedIn
 [AI Üret ▼]
 [Daha Kısa] [Emoji Ekle] [Hashtag Öner]
Tarih/saat seç
[Kaydet]   [Planla]
```

## 7.2 Drag & Drop Takvim

Aylık / haftalık / günlük görünüm toggle.
Platform bazlı renk kodlaması.
Takvim üzerinde post durumu: Taslak (gri) / Onayda (turuncu) / Onaylandı (yeşil) / Yayında (mavi).

## 7.3 AI Araçları (Inline)

Caption alanının altında:
- "AI ile Yaz" butonu
- "Yeniden Üret"
- "Daha Kısa Yaz"
- "Daha Uzun Yaz"
- "Emoji Ekle"
- "Hashtag Öner" (platform bazlı, AI destekli)

## 7.4 Toplu İçerik Yükleme

CSV import: tarih, platform, caption, medya URL kolonları.
Toplu onay: Tüm ay planını tek tıkla müşteriye gönder.

## 7.5 Post Durum Pipeline (Kanban)

```
Taslak → Onay Bekliyor → Onaylandı → Zamanlandı → Yayında → Arşiv
```

Kanban görünümü veya tablo görünümü toggle.

---

---

# UYGULAMA SIRASI

## Faz 1 — Kırık Olan Her Şey (1-2 hafta)

Sistemin temel işlevselliği için zorunlu:

| # | İş | Dosya |
|---|---|---|
| 1 | `editor` ve `account_manager` rolleri ekle | `lib/rbac/roles.ts` |
| 2 | Finansal permission'ları ayrıştır | `lib/rbac/permissions.ts` |
| 3 | Sidebar finansal gizleme | `AdminLayout.tsx` |
| 4 | Pricing sayfalarında kolon gizleme | `CatalogPage`, `ProposalViewPage` |
| 5 | Davet email'i gönder (Resend) | `api/invite-user.ts` |
| 6 | Davet kabul sayfası | `/join` route |
| 7 | Profil düzenle sayfası | `/admin/settings/profile` |
| 8 | Profil route'u ekle | `AdminApp.tsx` |
| 9 | Dashboard gerçek veriye bağla | `DashboardPage.tsx` |

---

## Faz 2 — Kritik Eksikler (2-3 hafta)

| # | İş |
|---|---|
| 1 | Bildirim sistemi (Firestore şema + hook + UI panel) |
| 2 | Bildirim ayarları sayfası |
| 3 | Her servise bildirim tetikleyici ekle |
| 4 | Asset kütüphanesi gerçek implementasyonu |
| 5 | Kullanıcı yönetim ekranı geliştirmesi (son giriş, filtre) |
| 6 | Firebase Auth custom claims geçişi |

---

## Faz 3 — Müşteri Portalı (3-4 hafta)

| # | İş |
|---|---|
| 1 | Portal layout tasarımı ve route yapısı |
| 2 | Client giriş yönlendirmesi (`/portal`) |
| 3 | Portal dashboard |
| 4 | Portal proje görünümü |
| 5 | Gelişmiş içerik onay ekranı (yorum + revizyon) |
| 6 | Portal mobil optimizasyonu |

---

## Faz 4 — İyileştirmeler (2-3 hafta)

| # | İş |
|---|---|
| 1 | Sosyal medya tek ekran post oluşturma |
| 2 | Drag & drop takvim |
| 3 | AI inline caption araçları |
| 4 | Eğitim modülü Firestore entegrasyonu |
| 5 | Email şablonları (tüm transactional email'ler) |
| 6 | Storage tenant izolasyonu |
| 7 | Rate limiting |
| 8 | Composite index'ler |

---

## Toplam Tahmini Süre

| Faz | Süre |
|---|---|
| Faz 1 | 1-2 hafta |
| Faz 2 | 2-3 hafta |
| Faz 3 | 3-4 hafta |
| Faz 4 | 2-3 hafta |
| **Toplam** | **8-12 hafta** |

---

## Kritik Kural

> Güvenlik katmanları sırasıyla uygulanmalı:
> 1. UI seviyesi (sidebar gizleme, kolon gizleme)
> 2. API seviyesi (withAuth + permission kontrolü)
> 3. Firestore rules seviyesi (query engelleme)
>
> Sadece birini yapmak yeterli değil. Üçü birden olmalı.
