# Faz 1 Agentic Review Planı

> Bu plan, Faz 1 kapsamında hayata geçirilen tüm özelliklerin sistematik review'unu tanımlar.
> Her adım otomatik doğrulama, UI review ve entegrasyon testlerini kapsar.

---

## Teslim Edilen Özellikler (Review Kapsamı)

| # | Özellik | Dosyalar |
|---|---|---|
| 1 | `account_manager` ve `editor` rolleri | `lib/rbac/roles.ts`, `lib/rbac/permissions.ts`, `shared/types/user.ts` |
| 2 | Sidebar finansal nav gizleme | `admin/AdminLayout.tsx` |
| 3 | Pricing maliyet kolonları gizleme | `admin/pricing/catalog/components/ServiceCard.tsx`, `admin/pricing/proposals/ProposalViewPage.tsx` |
| 4 | Davet email API | `api/invite-user.ts`, `shared/hooks/useUserManagement.ts` |
| 5 | Davet kabul sayfası | `admin/auth/JoinPage.tsx`, `App.tsx` |
| 6 | Profil düzenleme sayfası | `admin/settings/ProfilePage.tsx`, `admin/AdminApp.tsx` |
| 7 | Dashboard gerçek veriye bağlantı | `admin/dashboard/DashboardPage.tsx` |

---

## Review Adımları

### 1. TypeScript & Derleme Kontrolü

```bash
# Tüm dosyaları TypeScript ile derle — hata olmamalı
npx tsc --noEmit 2>&1 | grep -v "dataconnect-generated"

# Beklenen çıktı: boş (hata yok)
```

**Kontrol edilecekler:**
- [ ] `UserRole` tipine `account_manager` ve `editor` eklendi mi?
- [ ] `Invitation` ve `InvitationStatus` tipleri `shared/types/user.ts`'de tanımlı mı?
- [ ] `PERMISSIONS.PRICING_VIEW_COST` ve `PRICING_VIEW_MARGIN` `permissions.ts`'de var mı?
- [ ] `usePermission` hook'u `ServiceCard.tsx` ve `ProposalViewPage.tsx`'de doğru import edildi mi?

---

### 2. RBAC Rol/Permission Matrisi Doğrulama

```typescript
// Test: Her rol için beklenen permission'lar
import { ROLES } from '@/lib/rbac/roles';
import { PERMISSIONS } from '@/lib/rbac/permissions';

// account_manager: PRICING_VIEW_PRICE var, PRICING_VIEW_COST/MARGIN yok
assert(ROLES.account_manager.permissions.includes(PERMISSIONS.PRICING_VIEW_PRICE));
assert(!ROLES.account_manager.permissions.includes(PERMISSIONS.PRICING_VIEW_COST));
assert(!ROLES.account_manager.permissions.includes(PERMISSIONS.PRICING_VIEW_MARGIN));

// editor: Hiçbir pricing permission yok
assert(!ROLES.editor.permissions.some(p => p.startsWith('pricing:')));

// admin: Tüm permission'lar var
assert(ROLES.admin.permissions.includes(PERMISSIONS.PRICING_FULL));
assert(ROLES.admin.permissions.includes(PERMISSIONS.PRICING_VIEW_COST));
```

**Kontrol edilecekler:**
- [ ] `editor` rolü hiçbir `pricing:*` permission içermiyor mu?
- [ ] `account_manager` sadece `pricing:view_price` görüyor mu?
- [ ] `staff` rolünde `MARKETING_BUDGET` ve pricing permissions kaldırıldı mı? *(not: bu task kaldırılmadı, gelecek faz)*
- [ ] `client` rolünde pricing hiç yok mu?

---

### 3. Sidebar Gizleme Testi (UI Simulation)

**Senaryo A — editor rolü:**
```
Gizlenmeli:
  - Hizmet Katalogu (/admin/pricing/catalog)
  - Teklif Dokümanları (/admin/pricing/proposals)
  - Finansal Yönetim (/admin/pricing/costs)
  - Fiyat Teklifi (/admin/pricing/quote)

Görünmeli:
  - Sosyal Medya
  - Projeler
  - Görevler
  - Onaylar
  - Dosyalama
```

**Senaryo B — account_manager rolü:**
```
Gizlenmeli:
  - Finansal Yönetim
  - Fiyat Teklifi

Görünmeli:
  - Hizmet Katalogu (fiyat görür, maliyet/kar görmez)
  - Teklif Dokümanları (sadece toplam fiyat görür)
  - Müşteri İlişkileri tüm modülleri
```

**Kontrol edilecekler:**
- [ ] `AdminLayout.tsx`'te `hiddenForRoles` array'leri doğru roller için set edildi mi?
- [ ] `filteredNavItems` logic'i hem `permission` hem `hiddenForRoles` kontrol ediyor mu?

---

### 4. ServiceCard Finansal Veri Gizleme Testi

**Dosya:** `admin/pricing/catalog/components/ServiceCard.tsx`

```
Test Case 1 — admin rolü:
  ✅ "Maliyet" satırı görünür
  ✅ "Teklif Fiyatı" satırı görünür
  ✅ "Kar" satırı görünür

Test Case 2 — account_manager rolü (PRICING_VIEW_PRICE only):
  ❌ "Maliyet" satırı GİZLİ
  ✅ "Teklif Fiyatı" satırı görünür
  ❌ "Kar" satırı GİZLİ

Test Case 3 — editor rolü (hiç pricing yok):
  ❌ "Maliyet" satırı GİZLİ
  ✅ "Teklif Fiyatı" satırı görünür (bu client-facing bilgi)
  ❌ "Kar" satırı GİZLİ
```

**Kontrol edilecekler:**
- [ ] `canViewCost = can(PERMISSIONS.PRICING_VIEW_COST)` doğru çalışıyor mu?
- [ ] `canViewMargin = can(PERMISSIONS.PRICING_VIEW_MARGIN)` doğru çalışıyor mu?
- [ ] "Teklif Fiyatı" her zaman görünür kalıyor mu (asla gizlenmiyor)?

---

### 5. ProposalViewPage Gizleme Testi

**Dosya:** `admin/pricing/proposals/ProposalViewPage.tsx`

```
Test Case 1 — admin rolü:
  ✅ "Teklif Bilgilerini Düzenle" paneli görünür
  ✅ "Iskonto hesaplama detayları" görünür
  ✅ Ekonomik parametreler düzenlenebilir

Test Case 2 — account_manager rolü:
  ❌ "Teklif Bilgilerini Düzenle" paneli GİZLİ
  ❌ "Iskonto hesaplama detayları" GİZLİ
  ✅ Teklif dokümanı (hizmet kalemleri, toplam) görünür
  ✅ Ödeme planları görünür
```

**Kontrol edilecekler:**
- [ ] `{isEditing && canViewCost && ...}` editing paneli doğru gizleniyor mu?
- [ ] `{isRecurring && canViewCost && ...}` ekonomik detaylar doğru gizleniyor mu?

---

### 6. Davet Sistemi Entegrasyon Testi

**Flow testi:**
1. Admin → `/admin/settings/users` → "Kullanıcı Davet Et"
2. Email ve rol seçimi → "Davet Gönder"
3. Firestore `invitations` koleksiyonuna kayıt oluştu mu?
4. `/api/invite-user` endpoint'i çağrıldı mı?
5. `invitationId` ile `/join?token=<id>` linkini aç
6. JoinPage yükleniyor mu?

```
Doğrulanacak Firestore yapısı:
invitations/{id} {
  tenantId: string ✅
  email: string ✅
  displayName: string ✅
  role: UserRole ✅
  status: 'pending' ✅
  invitedBy: uid ✅
  invitedByName: string ✅
  createdAt: Timestamp ✅
  expiresAt: Timestamp (7 gün) ✅
}
```

**API endpoint kontrolleri:**
- [ ] `api/invite-user.ts` sadece `admin` ve `super_admin` rollerine izin veriyor mu?
- [ ] Geçersiz rol ile istek 403 dönüyor mu?
- [ ] `RESEND_API_KEY` env variable eksikse graceful hata veriyor mu?

---

### 7. JoinPage Akış Testi

**Geçerli token:**
```
✅ Sayfa yükleniyor
✅ Davet bilgileri (email, rol, davet eden) gösteriliyor
✅ Ad Soyad ve şifre formu çalışıyor
✅ Şifre eşleşme kontrolü
✅ Firebase Auth hesabı oluşturuluyor (createUserWithEmailAndPassword)
✅ Firestore users/{uid} document oluşturuluyor
✅ Role ait permissions array set ediliyor
✅ Invitation status 'accepted' olarak güncelleniyor
✅ /admin'e yönlendirme gerçekleşiyor
```

**Hata senaryoları:**
```
❌ Geçersiz token → "Davet bulunamadı" hata mesajı
❌ Süresi dolmuş token → "Süresi dolmuş" hata mesajı
❌ Zaten kabul edilmiş → "Zaten kabul edilmiş" mesajı
❌ İptal edilmiş → "İptal edilmiş" mesajı
❌ Zayıf şifre → Form validation hatası
❌ Şifreler eşleşmiyor → Form validation hatası
```

**Kontrol edilecekler:**
- [ ] `/join` route App.tsx'te kayıtlı mı?
- [ ] Route `AdminLayout` dışında mı? (auth gerekmez)
- [ ] `TenantProvider` sarmalanmış mı? *(not: JoinPage TenantProvider içinde değil — beklenen durum)*
- [ ] Firebase Storage Rules Firestore yazma izni veriyor mu? `users` koleksiyonu

---

### 8. Profil Sayfası Testi

**Route:** `/admin/settings/profile`

```
✅ Kullanıcı bilgileri yükleniyor (displayName, email, phone, title)
✅ Email alanı disabled (değiştirilemez)
✅ Rol badge gösteriliyor
✅ Profil formu kaydedilebiliyor
✅ Firebase Auth displayName güncelleniyor
✅ Firestore users/{uid} profile fields güncelleniyor
✅ Şifre değiştirme formu çalışıyor
✅ Re-authentication ile mevcut şifre doğrulanıyor
✅ Başarı mesajı gösteriliyor
```

**Hata senaryoları:**
```
❌ Yanlış mevcut şifre → "Mevcut şifre yanlış" mesajı
❌ Şifreler eşleşmiyor → Form validation
❌ 8 karakterden kısa şifre → Form validation
```

**Kontrol edilecekler:**
- [ ] `settings/profile` route AdminApp.tsx'te kayıtlı mı?
- [ ] `SettingsPage`'deki "Profil" butonu `/admin/settings/profile`'a gidiyor mu?
- [ ] `useAuth().refreshUser()` çağrısı profil güncellemesinin ardından yapılıyor mu?

---

### 9. Dashboard Gerçek Veri Testi

**Kontrol edilecekler:**
```
✅ useDashboardStats hook import edildi
✅ Stat kartları: activeProjects, pendingApprovals, teamMembers, completedThisMonth
✅ Stats loading sırasında skeleton gösteriliyor
✅ recentActivity Firestore activityLog koleksiyonundan geliyor
✅ pendingApprovals Firestore approvals koleksiyonundan geliyor
✅ Hardcoded demo veriler kaldırıldı
✅ dueDateText (formatted string) kullanılıyor (Date objesi değil)
```

**Firestore index gereksinimleri:**
```
activityLog: tenantId + createdAt (composite index gerekebilir)
approvals: tenantId + status (composite index gerekebilir)
projects: tenantId + status + completedAt (3'lü composite)
```

- [ ] Bu sorgular için Firestore indexes tanımlı mı? (`firestore.indexes.json`)

---

### 10. Güvenlik Katmanı Doğrulama

**Sidebar UI guard yeterli mi?**
```
URL'e doğrudan erişim senaryoları:
- editor → /admin/pricing/catalog → Yükleniyor mu?
  → UI'da görünmüyor ama URL engellenmemiş
  → Öneri: Route seviyesinde PermissionGuard ekle (Faz 2)

- account_manager → /admin/pricing/costs → Yükleniyor mu?
  → Benzer şekilde sadece nav gizleniyor

⚠️ NOT: Mevcut implementation sadece UI guard.
   Firestore Rules ve API middleware ile korunma Faz 2 kapsamında.
```

---

## Agentic Review Execution

Aşağıdaki agent görevi sırayla çalıştırılabilir:

```
agent: Review Faz 1 - TypeScript ve Roller
tasks:
  - npx tsc --noEmit kontrolü
  - ROLES ve PERMISSIONS consistency check
  - UserRole type güncel mi?

agent: Review Faz 1 - UI Guard Simülasyonu
tasks:
  - AdminLayout hiddenForRoles logic okuma
  - ServiceCard canViewCost/canViewMargin logic
  - ProposalViewPage canViewCost logic

agent: Review Faz 1 - Route ve Sayfa Varlığı
tasks:
  - /join route App.tsx'te var mı?
  - /admin/settings/profile route AdminApp.tsx'te var mı?
  - /admin/settings/users route AdminApp.tsx'te var mı?
  - JoinPage.tsx dosyası var mı?
  - ProfilePage.tsx dosyası var mı?

agent: Review Faz 1 - API Endpoint
tasks:
  - api/invite-user.ts var mı?
  - withAuth kullanılıyor mu?
  - Rol kontrolü (admin/super_admin) var mı?
  - Resend email gönderimi doğru mı?

agent: Review Faz 1 - Dashboard
tasks:
  - useDashboardStats import edildi mi?
  - Hardcoded değerler kaldırıldı mı?
  - Loading skeleton var mı?
  - recentActivity.timeAgo kullanılıyor mu (activity.time değil)?
```

---

## Faz 1 Tamamlanma Kriterleri

| Kriter | Durum |
|---|---|
| TypeScript derleme hatasız | ✅ |
| `account_manager` ve `editor` rolleri tanımlı | ✅ |
| Sidebar finansal gizleme çalışıyor | ✅ |
| ServiceCard maliyet/kar gizleme | ✅ |
| ProposalViewPage maliyet paneli gizleme | ✅ |
| Davet email API endpoint | ✅ |
| Davet kabul sayfası (/join) | ✅ |
| Profil düzenleme sayfası | ✅ |
| Dashboard gerçek veri | ✅ |

---

## Faz 2 — Sonraki Adımlar

1. **Route-level PermissionGuard** — URL ile direkt erişim engeli
2. **Firestore Security Rules** — `pricing` koleksiyonuna rol bazlı kısıt
3. **API middleware** — fiyatlandırma API'lerinde rol kontrolü
4. **Client Portal** (`/portal`) — Müşteri için ayrı layout ve sayfalar
5. **Notification System** — Bell icon'u gerçek veriye bağla
6. **Email şablonları** — Resend ile branded email HTML
7. **Rol bazlı Dashboard** — Her role özel metrik setleri
