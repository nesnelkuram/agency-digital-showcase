# Multi-Tenant Dönüşüm Planı

## Bağlam

Mevcut uygulama tek bir ajans (Intiba) için tasarlanmış monolitik bir yapıda. Amaç, admin panelini multi-tenant hale getirerek birden fazla ajansın/müşterinin aynı altyapıyı kullanmasını sağlamak. Public site (landing page, brand strategy wizard) tek kalacak.

**Kararlar:**
- Shared Firestore DB + `tenantId` field izolasyonu
- Login-based tenant routing (tek URL, login sonrası otomatik yönlendirme)
- Sadece admin panel multi-tenant
- Temel tenant CRUD (billing yok)

---

## Faz 1: Veri Modeli & Tenant Temeli

### 1.1 Tenant Type Tanımı

**Yeni dosya: `shared/types/tenant.ts`**

```typescript
import { Timestamp } from 'firebase/firestore';

export type TenantStatus = 'active' | 'suspended' | 'trial';

export interface Tenant {
  id: string;
  name: string;           // "Acme Corp"
  slug: string;           // "acme-corp"
  status: TenantStatus;
  settings: TenantSettings;
  metadata: {
    createdAt: Timestamp;
    updatedAt: Timestamp;
    createdBy: string;
  };
}

export interface TenantSettings {
  maxUsers: number;
  allowedFeatures: string[];  // ['marketing', 'feedback', 'pricing']
  branding?: {
    logoUrl?: string;
    primaryColor?: string;
    companyName?: string;
  };
  timezone?: string;
  currency?: string;
}

export interface CreateTenantData {
  name: string;
  slug: string;
  settings?: Partial<TenantSettings>;
}
```

Firestore koleksiyonu: `tenants`

### 1.2 User Model Güncelleme

**Dosya: `shared/types/user.ts`**

- `UserRole`'e `'super_admin'` eklenir
- `tenantId: string` field'ı eklenir (mevcut `organizationId` yerine geçer)
- `CreateUserData`'ya `tenantId` eklenir

```typescript
export type UserRole = 'super_admin' | 'admin' | 'staff' | 'client' | 'freelancer';

export interface User {
  uid: string;
  email: string;
  displayName: string;
  photoURL?: string;
  role: UserRole;
  tenantId: string;           // YENİ - zorunlu (super_admin hariç)
  organizationId?: string;    // DEPRECATED - migration için kalır
  permissions: string[];
  status: UserStatus;
  metadata: UserMetadata;
  profile: UserProfile;
  settings: UserSettings;
}

export interface CreateUserData {
  email: string;
  displayName: string;
  role: UserRole;
  tenantId: string;           // YENİ
  organizationId?: string;    // DEPRECATED
}
```

### 1.3 RBAC Güncellemeleri

**Dosya: `lib/rbac/permissions.ts`** — Tenant yönetim izinleri eklenir:

```typescript
// Tenant Management (super_admin only)
TENANTS_VIEW: 'tenants:view',
TENANTS_CREATE: 'tenants:create',
TENANTS_EDIT: 'tenants:edit',
TENANTS_DELETE: 'tenants:delete',
TENANTS_SWITCH: 'tenants:switch',
```

**Dosya: `lib/rbac/roles.ts`** — `super_admin` rolü eklenir (tüm izinler + tenant izinleri)

**Dosya: `lib/rbac/guards.ts`** — `isSuperAdmin()` helper eklenir:

```typescript
export function isSuperAdmin(user: User | null): boolean {
  return user?.role === 'super_admin';
}
```

### 1.4 TenantContext Provider

**Yeni dosya: `contexts/TenantContext.tsx`**

```typescript
interface TenantContextType {
  tenant: Tenant | null;
  tenantId: string | null;
  loading: boolean;
  error: string | null;
  isSuperAdmin: boolean;
  switchTenant: (tenantId: string) => Promise<void>;  // sadece super_admin
  activeTenantId: string | null;  // super_admin'in aktif olarak görüntülediği tenant
}
```

**Mantık:**
1. Mount'ta `user.tenantId`'yi AuthContext'ten okur
2. `tenants/{tenantId}` dokümanını Firestore'dan yükler
3. Super admin için: tenant picker gösterir, seçilen tenant'ı `activeTenantId`'de tutar
4. Tüm child component'lere `tenantId` sağlar (user'ın kendi veya super_admin'in seçimi)

**Entegrasyon (App.tsx):**
```tsx
<Route
  path="/admin/*"
  element={
    <Suspense fallback={...}>
      <TenantProvider>  {/* YENİ: admin panelini sarar */}
        <AdminApp />
      </TenantProvider>
    </Suspense>
  }
/>
```

### 1.5 useTenant Hook

**Yeni dosya: `shared/hooks/useTenant.ts`**

```typescript
export function useTenant() {
  const context = useContext(TenantContext);
  if (!context) throw new Error('useTenant must be used within a TenantProvider');
  return context;
}

export function useTenantId(): string {
  const { tenantId, activeTenantId, isSuperAdmin } = useTenant();
  const effectiveId = isSuperAdmin ? activeTenantId : tenantId;
  if (!effectiveId) throw new Error('No active tenant selected');
  return effectiveId;
}
```

### 1.6 AuthContext Güncelleme

**Dosya: `contexts/AuthContext.tsx`**

- `fetchUserData` (satır 33-45): `tenantId` || `organizationId` fallback ile okur
- `signIn` (satır 96-127): Tenant'ı olmayan ve super_admin olmayan kullanıcıları reddeder

---

## Faz 2: Tenant-Aware Query Katmanı (KRİTİK)

Bu faz en fazla dosyayı etkileyen ve en kritik faz. Amacı: her Firestore query'sine ve her doküman yazma işlemine `tenantId` enjekte etmek.

### 2.1 Tenant Query Helper

**Yeni dosya: `lib/firebase/tenantDb.ts`**

Firestore SDK'yı replace etmez, belirli operasyonları wrap eder:

```typescript
import {
  collection, query, where, addDoc, QueryConstraint, DocumentData,
} from 'firebase/firestore';
import { db } from './config';

/**
 * Verilen koleksiyona tenantId filtresi eklenmiş query döner.
 * Kullanım: collection(db, 'marketing_campaigns') yerine
 *           tenantQuery('marketing_campaigns', tenantId, ...constraints)
 */
export function tenantQuery(
  collectionName: string,
  tenantId: string,
  ...constraints: QueryConstraint[]
) {
  if (!db) throw new Error('Firebase not initialized');
  if (!tenantId) throw new Error('tenantId is required for tenant-scoped queries');
  return query(
    collection(db, collectionName),
    where('tenantId', '==', tenantId),
    ...constraints
  );
}

/**
 * Dokümana tenantId field'ı ekler.
 * Kullanım: data objesi yerine withTenantId(data, tenantId)
 */
export function withTenantId<T extends Record<string, any>>(
  data: T,
  tenantId: string
): T & { tenantId: string } {
  if (!tenantId) throw new Error('tenantId is required');
  return { ...data, tenantId };
}

/**
 * tenantId ile otomatik doküman oluşturur.
 */
export async function tenantAddDoc(
  collectionName: string,
  tenantId: string,
  data: DocumentData
): Promise<string> {
  if (!db) throw new Error('Firebase not initialized');
  if (!tenantId) throw new Error('tenantId is required');
  const docRef = await addDoc(collection(db, collectionName), { ...data, tenantId });
  return docRef.id;
}

/**
 * Tenant scope'undan muaf koleksiyonlar:
 * - tenants (tenant registry)
 * - Website'den gelen brand_leads (public, tenantId yok)
 */
export const GLOBAL_COLLECTIONS = new Set(['tenants']);
```

### 2.2 Service Refactoring Paterni

**Tasarım kararı:** Service fonksiyonları `tenantId`'yi **parametre** olarak alır (React context'ten değil).

**Nedenleri:**
- Service dosyaları plain function, React hook kullanamazlar
- API route'ları (server-side) da aynı servisleri kullanabilir
- Explicit parametre = test edilebilir, güvenli, izlenebilir
- Mevcut `createdByUid` parametresiyle aynı pattern

**Dönüşüm örneği:**

```typescript
// ===== ÖNCE =====
export async function getBrandLeads(
  filters?: BrandLeadFilters,
  pageSize: number = 20,
  lastDoc?: DocumentSnapshot
) {
  const constraints: QueryConstraint[] = [];
  if (filters?.status) constraints.push(where('status', 'in', filters.status));
  // ...
  const q = query(collection(db, COLLECTION_NAME), ...constraints);
  const snapshot = await getDocs(q);
}

export async function createBrandLead(
  data: CreateBrandLeadData,
  createdByUid: string,
  createdByName: string
): Promise<string> {
  const leadData = { ...data, createdAt: serverTimestamp() };
  const docRef = await addDoc(collection(db, COLLECTION_NAME), stripUndefined(leadData));
  return docRef.id;
}

// ===== SONRA =====
export async function getBrandLeads(
  tenantId: string,                  // YENİ: ilk parametre
  filters?: BrandLeadFilters,
  pageSize: number = 20,
  lastDoc?: DocumentSnapshot
) {
  const constraints: QueryConstraint[] = [
    where('tenantId', '==', tenantId),  // YENİ: her zaman ilk constraint
  ];
  if (filters?.status) constraints.push(where('status', 'in', filters.status));
  // ...
  const q = query(collection(db, COLLECTION_NAME), ...constraints);
  const snapshot = await getDocs(q);
}

export async function createBrandLead(
  tenantId: string,                  // YENİ: ilk parametre
  data: CreateBrandLeadData,
  createdByUid: string,
  createdByName: string
): Promise<string> {
  const leadData = { ...data, tenantId, createdAt: serverTimestamp() };  // YENİ: tenantId eklendi
  const docRef = await addDoc(collection(db, COLLECTION_NAME), stripUndefined(leadData));
  return docRef.id;
}
```

**Component'lerde kullanım:**

```typescript
// Admin page component
function LeadsPage() {
  const tenantId = useTenantId();  // hook'tan al

  const loadLeads = useCallback(async () => {
    const result = await getBrandLeads(tenantId, filters, 20, lastDoc);  // tenantId ilet
    setLeads(result.leads);
  }, [tenantId, filters]);
}
```

### 2.3 Güncellenecek 14 Service Dosyası

| # | Dosya | Koleksiyon(lar) | Tahmini Fonksiyon Sayısı |
|---|-------|----------------|-------------------------|
| 1 | `shared/services/brandLeadService.ts` | `brand_leads` | ~12 fonksiyon |
| 2 | `shared/services/projectService.ts` | `projects`, `quotes` | ~12 fonksiyon |
| 3 | `shared/services/marketingService.ts` | `marketing_campaigns`, `campaign_proposals`, `platform_accounts`, `performance_snapshots`, `optimization_suggestions`, `campaign_breakdowns`, `campaign_ai_analyses` | ~30+ fonksiyon |
| 4 | `shared/services/socialMediaService.ts` | `social_media_posts` | ~8 fonksiyon |
| 5 | `shared/services/creativeService.ts` | `creatives` | ~6 fonksiyon |
| 6 | `shared/services/feedbackService.ts` | `feedback_videos`, `feedback_comments`, `feedback_reactions` | ~15 fonksiyon |
| 7 | `shared/services/automationRuleService.ts` | `automation_rules`, `rule_execution_logs` | ~8 fonksiyon |
| 8 | `shared/services/reportService.ts` | `marketing_reports` | ~5 fonksiyon |
| 9 | `shared/services/competitorService.ts` | `competitors`, `competitor_analyses` | ~6 fonksiyon |
| 10 | `shared/services/budgetForecastService.ts` | `budget_forecasts` | ~5 fonksiyon |
| 11 | `shared/services/alertService.ts` | `marketing_alerts` | ~5 fonksiyon |
| 12 | `shared/services/templateService.ts` | `campaign_templates` | ~5 fonksiyon |
| 13 | `shared/services/utmService.ts` | `utm_links` | ~5 fonksiyon |
| 14 | `shared/services/abTestService.ts` | `ab_tests` | ~5 fonksiyon |

**Her dosyada yapılacak:**
1. Tüm exported fonksiyonlara ilk parametre olarak `tenantId: string` eklenir
2. Tüm `query()` çağrılarına `where('tenantId', '==', tenantId)` constraint eklenir
3. Tüm `addDoc()` / `setDoc()` çağrılarına `tenantId` field'ı eklenir
4. `withTenantId()` helper import edilir ve kullanılır

### 2.4 Güncellenecek Hook'lar

Inline Firestore query'leri olan hook'lar:

| Hook | Değişiklik |
|------|-----------|
| `shared/hooks/useDashboardStats.ts` | 5 paralel query'ye (projects, approvals, users, completed, activityLog) `where('tenantId', '==', tenantId)` eklenir |
| `shared/hooks/useUserManagement.ts` | `users` + `invitations` query'lerine `tenantId` filtresi, invitation creation'a `tenantId` field'ı eklenir |
| `shared/hooks/useAssetManagement.ts` | `assets` + `assetFolders` query'lerine `tenantId` filtresi, create işlemlerine `tenantId` field'ı eklenir |

Her hook'un başına `const tenantId = useTenantId()` eklenir.

### 2.5 Admin Page Component'leri

Service fonksiyon imzaları değiştiğinden, tüm admin page'ler güncellenir:
- Hook'tan `tenantId` alınır: `const tenantId = useTenantId()`
- Service çağrılarına `tenantId` ilk parametre olarak eklenir

### 2.6 Özel Durumlar

**Public lead oluşturma:** `createBrandLeadFromWebsite()` fonksiyonu **DEĞİŞMEZ**. Public website'den gelen lead'lerin tenant'ı yoktur. Admin bir lead'i claim/manage ettiğinde `updateBrandLead()` ile `tenantId` set edilir.

**Pricing koleksiyonları:** `pricing/data/serviceCatalog` gibi nested document pattern kullanıyor. Bu koleksiyonlarda path'e tenant eklenir: `pricing/{tenantId}/data/serviceCatalog`.

---

## Faz 3: API Layer Tenant Awareness

### 3.1 Auth + Tenant Middleware

**Yeni dosya: `api/_lib/withAuth.ts`**

**Mevcut durum:** Hiçbir API route authentication doğrulaması yapmıyor. User ID'leri client'tan gelen request body'den alınıyor. Bu kritik bir güvenlik açığı.

```typescript
import { getAdminDb } from './firebaseAdmin';
import { getAuth } from 'firebase-admin/auth';
import type { VercelRequest, VercelResponse } from '@vercel/node';

export interface AuthenticatedRequest extends VercelRequest {
  userId: string;
  tenantId: string;
  userRole: string;
}

export function withAuth(
  handler: (req: AuthenticatedRequest, res: VercelResponse) => Promise<any>
) {
  return async (req: VercelRequest, res: VercelResponse) => {
    const authHeader = req.headers.authorization;
    if (!authHeader?.startsWith('Bearer ')) {
      return res.status(401).json({ error: 'Missing or invalid Authorization header' });
    }

    const token = authHeader.split('Bearer ')[1];
    try {
      const auth = getAuth();
      const decoded = await auth.verifyIdToken(token);
      const db = getAdminDb();
      const userDoc = await db.collection('users').doc(decoded.uid).get();

      if (!userDoc.exists) {
        return res.status(403).json({ error: 'User profile not found' });
      }

      const userData = userDoc.data()!;
      const tenantId = userData.tenantId || userData.organizationId;

      if (!tenantId && userData.role !== 'super_admin') {
        return res.status(403).json({ error: 'User has no tenant association' });
      }

      (req as AuthenticatedRequest).userId = decoded.uid;
      (req as AuthenticatedRequest).tenantId = tenantId || '';
      (req as AuthenticatedRequest).userRole = userData.role;

      return handler(req as AuthenticatedRequest, res);
    } catch (error: any) {
      return res.status(401).json({ error: 'Invalid or expired token' });
    }
  };
}
```

### 3.2 Client-Side Auth Token Gönderimi

**Yeni dosya: `lib/firebase/apiClient.ts`**

```typescript
import { auth } from './config';

export async function authenticatedFetch(
  url: string,
  options: RequestInit = {}
): Promise<Response> {
  const user = auth?.currentUser;
  if (!user) throw new Error('Not authenticated');

  const token = await user.getIdToken();

  return fetch(url, {
    ...options,
    headers: {
      ...options.headers,
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
  });
}
```

Mevcut tüm `fetch('/api/...')` çağrıları `authenticatedFetch` ile değiştirilir.

### 3.3 Güncellenecek API Route'lar

Her route `withAuth` ile wrap edilir ve `req.tenantId` kullanılır:

| Dosya | Not |
|-------|-----|
| `api/analyze-start.ts` | tenantId'yi checkpoint manager'a ilet |
| `api/analyze-continue.ts` | tenantId doğrulaması |
| `api/analyze-brand.ts` | withAuth wrap |
| `api/analyze-brand-multi.ts` | withAuth wrap |
| `api/marketing/generate-campaign.ts` | withAuth wrap |
| `api/marketing/generate-proposal.ts` | withAuth + tenantId write |
| `api/marketing/approve-proposal.ts` | withAuth + tenant ownership verify |
| `api/marketing/execute-campaign.ts` | withAuth wrap |
| `api/marketing/optimize.ts` | withAuth wrap |
| `api/marketing/generate-ad-copy.ts` | withAuth wrap |
| `api/marketing/forecast-budget.ts` | withAuth wrap |
| `api/marketing/analyze-competitor.ts` | withAuth wrap |
| `api/marketing/analyze-campaign.ts` | withAuth wrap |
| `api/marketing/ai-optimize.ts` | withAuth wrap |
| `api/marketing/sync-campaigns.ts` | upsert'lere tenantId ekle |
| `api/marketing/sync-performance.ts` | withAuth wrap |
| `api/marketing/sync-breakdowns.ts` | withAuth wrap |
| `api/marketing/sync-google.ts` | withAuth wrap |
| `api/marketing/sync-tiktok.ts` | withAuth wrap |
| `api/marketing/sync-linkedin.ts` | withAuth wrap |
| `api/marketing/generate-report.ts` | withAuth + tenant-scoped queries |
| `api/marketing/platforms/connect.ts` | OAuth state'e tenantId ekle |
| `api/marketing/platforms/callback.ts` | state'ten tenantId çıkar |
| `api/send-feedback-notification.ts` | withAuth wrap |
| `api/send-report.ts` | withAuth wrap |
| `api/transcribe-video.ts` | withAuth wrap |

**Refactor notu:** Bazı API route'lar (ör. `generate-report.ts`) kendi `getAdminDb()` fonksiyonunu tanımlıyor. Bunlar shared `api/_lib/firebaseAdmin.ts` modülüne refactor edilir.

**Özel durumlar:**
- `api/persona/*` — Public endpoint olarak kalır (conditional auth)
- `api/cron/marketing-optimize.ts` — User context yok, tüm active tenant'ları iterate eder

### 3.4 Checkpoint Manager

**Dosya: `api/_lib/checkpointManager.ts`**

- `tenantId` parametresi eklenir
- Lead ownership doğrulaması: checkpoint operations öncesi lead'in `tenantId`'si kontrol edilir

---

## Faz 4: Security Rules

### 4.1 Firestore Rules

**Dosya: `firestore.rules`**

Mevcut rules sadece `request.auth != null` kontrolü yapıyor — tenant izolasyonu YOK.

**Yeni yapı:**

```javascript
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {

    // ============================================
    // HELPER FUNCTIONS
    // ============================================

    function getUserTenantId() {
      return get(/databases/$(database)/documents/users/$(request.auth.uid)).data.tenantId;
    }

    function isSuperAdmin() {
      return get(/databases/$(database)/documents/users/$(request.auth.uid)).data.role == 'super_admin';
    }

    function belongsToTenant(tenantId) {
      return request.auth != null && (isSuperAdmin() || getUserTenantId() == tenantId);
    }

    // ============================================
    // TENANT COLLECTION
    // ============================================

    match /tenants/{tenantId} {
      allow read: if request.auth != null && (isSuperAdmin() || getUserTenantId() == tenantId);
      allow write: if request.auth != null && isSuperAdmin();
    }

    // ============================================
    // USERS
    // ============================================

    match /users/{userId} {
      allow read: if request.auth != null && (
        request.auth.uid == userId ||
        isSuperAdmin() ||
        getUserTenantId() == resource.data.tenantId
      );
      allow write: if request.auth != null && (
        isSuperAdmin() ||
        getUserTenantId() == resource.data.tenantId
      );
    }

    // ============================================
    // BRAND LEADS (mixed: public create + tenant-scoped admin)
    // ============================================

    match /brand_leads/{leadId} {
      allow create: if true;  // Website form - public
      allow read: if request.auth != null && (
        isSuperAdmin() ||
        resource.data.tenantId == getUserTenantId()
      ) || resource.data.shareToken != null;
      allow update, delete: if request.auth != null && (
        isSuperAdmin() ||
        resource.data.tenantId == getUserTenantId()
      );
    }

    // ============================================
    // FEEDBACK (public read for shared)
    // ============================================

    match /feedback_videos/{videoId} {
      allow read: if request.auth != null && (
        isSuperAdmin() || resource.data.tenantId == getUserTenantId()
      ) || resource.data.isPublic == true;
      allow write: if request.auth != null && (
        isSuperAdmin() || resource.data.tenantId == getUserTenantId()
      );
    }

    match /feedback_comments/{commentId} {
      allow read: if true;
      allow write: if request.auth != null;
    }

    match /feedback_reactions/{reactionId} {
      allow read: if true;
      allow write: if request.auth != null;
    }

    // ============================================
    // ALL OTHER TENANT-SCOPED COLLECTIONS
    // (marketing_campaigns, projects, social_media_posts, etc.)
    // ============================================

    match /{collectionName}/{docId} {
      allow read: if request.auth != null && (
        isSuperAdmin() ||
        resource.data.tenantId == getUserTenantId()
      );
      allow create: if request.auth != null && (
        isSuperAdmin() ||
        request.resource.data.tenantId == getUserTenantId()
      );
      allow update, delete: if request.auth != null && (
        isSuperAdmin() ||
        resource.data.tenantId == getUserTenantId()
      );
    }
  }
}
```

**Gelecek optimizasyon:** `getUserTenantId()` her rule evaluation'da Firestore read yapar. Billing ve latency etkisi var. Firebase Auth custom claims'e (`admin.auth().setCustomUserClaims(uid, { tenantId })`) geçilerek `request.auth.token.tenantId` kullanılır ve ekstra read elimine edilir.

### 4.2 Storage Rules

**Dosya: `storage.rules`**

Path yapısı tenant-scoped olur:

```javascript
rules_version = '2';
service firebase.storage {
  match /b/{bucket}/o {
    // Tenant-scoped feedback videos
    match /tenants/{tenantId}/feedback/{userId}/{allPaths=**} {
      allow read: if true;  // Public for shared videos
      allow write: if request.auth != null
                   && request.auth.uid == userId
                   && request.resource.size < 500 * 1024 * 1024;
    }

    // Tenant-scoped assets
    match /tenants/{tenantId}/assets/{userId}/{allPaths=**} {
      allow read: if request.auth != null;
      allow write: if request.auth != null
                   && request.auth.uid == userId
                   && request.resource.size < 100 * 1024 * 1024;
    }

    // Legacy paths (migration dönemi için)
    match /feedback/{userId}/{allPaths=**} {
      allow read: if true;
      allow write: if request.auth != null
                   && request.auth.uid == userId
                   && request.resource.size < 500 * 1024 * 1024;
    }
    match /assets/{userId}/{allPaths=**} {
      allow read: if request.auth != null;
      allow write: if request.auth != null
                   && request.auth.uid == userId
                   && request.resource.size < 100 * 1024 * 1024;
    }
  }
}
```

---

## Faz 5: Admin Panel UI

### 5.1 Tenant Switcher

**Yeni dosya: `admin/tenants/TenantSwitcher.tsx`**

Admin header'da (AdminLayout içinde) dropdown component:
- **Normal user** → Tenant adı (static label, değiştirilemez)
- **Super admin** → Tenant listesi dropdown, hızlı geçiş

### 5.2 Tenant Yönetim Sayfaları

**Yeni dosyalar:**
- `admin/tenants/TenantListPage.tsx` — Tüm tenant'lar listesi (isim, durum, kullanıcı sayısı, oluşturma tarihi)
- `admin/tenants/TenantDetailPage.tsx` — Tenant düzenleme, kullanıcıları görme, ayarlar
- `admin/tenants/CreateTenantPage.tsx` — Yeni tenant oluşturma formu

**Yeni service:**
- `shared/services/tenantService.ts` — Tenant CRUD operasyonları (super_admin only)

### 5.3 Route Güncellemeleri

**Dosya: `admin/AdminApp.tsx`**

Yeni route'lar (super_admin korumalı):

```
/admin/tenants       → TenantListPage
/admin/tenants/new   → CreateTenantPage
/admin/tenants/:id   → TenantDetailPage
```

### 5.4 AdminLayout Güncellemeleri

**Dosya: `admin/AdminLayout.tsx`**

- Header'a `TenantSwitcher` component eklenir (user avatar yanına)
- Sidebar'a "Tenant Yönetimi" menü öğesi eklenir (super_admin'e görünür, `PERMISSIONS.TENANTS_VIEW` ile korunur)
- Sidebar header'da aktif tenant adı gösterilir

### 5.5 Login Flow Güncelleme

**Dosya: `admin/auth/LoginPage.tsx`**

Login sonrası yönlendirme:
- **Super admin** → `/admin/tenants` (tenant seçim sayfası)
- **Normal user** (tenantId var) → `/admin` (dashboard, mevcut davranış)
- **Tenant'sız user** (super_admin değil) → Hata mesajı: "Hesabınız bir organizasyona bağlı değil"

### 5.6 AuthGuard Güncelleme

**Dosya: `admin/auth/AuthGuard.tsx`**

- Auth sonrası tenant resolution için loading state eklenir
- Super admin tenant seçmemişse tenant seçim sayfasına yönlendirir

---

## Faz 6: Data Migration

### 6.1 Migration Script

**Yeni dosya: `scripts/migrate-to-multi-tenant.ts`**

Firebase Admin SDK ile çalışan one-time Node.js script:

```typescript
// 1. Default tenant oluştur
const DEFAULT_TENANT = {
  id: 'default',
  name: 'Intiba',
  slug: 'intiba',
  status: 'active',
  settings: {
    maxUsers: 100,
    allowedFeatures: ['all'],
  },
  metadata: {
    createdAt: FieldValue.serverTimestamp(),
    updatedAt: FieldValue.serverTimestamp(),
    createdBy: 'migration-script',
  },
};

// 2. Migrate edilecek koleksiyonlar
const COLLECTIONS_TO_MIGRATE = [
  'users', 'brand_leads', 'projects', 'quotes', 'proposals', 'invitations',
  'marketing_campaigns', 'campaign_proposals', 'platform_accounts',
  'performance_snapshots', 'optimization_suggestions', 'campaign_breakdowns',
  'campaign_ai_analyses', 'marketing_budgets', 'marketing_alerts',
  'marketing_reports', 'budget_forecasts', 'competitors', 'competitor_analyses',
  'social_media_posts', 'creatives', 'campaign_templates', 'ab_tests',
  'utm_links', 'automation_rules', 'rule_execution_logs',
  'feedback_videos', 'feedback_comments', 'feedback_reactions',
  'assets', 'assetFolders', 'activityLog', 'approvals',
];

// 3. Her koleksiyon için batch update (500'lük gruplar)
for (const collectionName of COLLECTIONS_TO_MIGRATE) {
  const snapshot = await db.collection(collectionName).get();
  const batches = chunk(snapshot.docs, 500);
  for (const batch of batches) {
    const writeBatch = db.batch();
    for (const doc of batch) {
      if (!doc.data().tenantId) {
        writeBatch.update(doc.ref, { tenantId: 'default' });
      }
    }
    await writeBatch.commit();
    console.log(`Migrated ${batch.length} docs in ${collectionName}`);
  }
}

// 4. İlk admin user'ı super_admin olarak upgrade et
const adminUsers = await db.collection('users')
  .where('role', '==', 'admin').limit(1).get();
if (!adminUsers.empty) {
  await adminUsers.docs[0].ref.update({ role: 'super_admin' });
}
```

### 6.2 Firestore Composite Index'ler

**Dosya: `firestore.indexes.json`**

`tenantId` equality filter'ı olan yeni composite index'ler eklenir. Her query artık `where('tenantId', '==', ...)` ile başladığı için, mevcut composite index'lerin çoğuna `tenantId` field'ı eklenmelidir.

**Örnek:**
```json
{
  "collectionGroup": "marketing_campaigns",
  "queryScope": "COLLECTION",
  "fields": [
    { "fieldPath": "tenantId", "order": "ASCENDING" },
    { "fieldPath": "status", "order": "ASCENDING" },
    { "fieldPath": "createdAt", "order": "DESCENDING" }
  ]
}
```

**Not:** Firestore 200 composite index limiti var. Mevcut 108 index'e ~20-30 yeni index eklenmesi gerekebilir. Mevcut index'ler audit edilip konsolidasyon yapılmalı.

---

## Faz Bağımlılıkları

```
Faz 1 (Veri Modeli & Temel)
    │
    v
Faz 2 (Query Layer) ──────────────────┐
    │                                   │
    v                                   v
Faz 3 (API Layer)                  Faz 4 (Security Rules)
    │                                   │
    │                                   │
    v                                   v
Faz 5 (Admin UI) ◄────────────────────┘
    │
    v
Faz 6 (Data Migration) — TÜM KOD DEĞİŞİKLİKLERİ TAMAMLANDIKTAN SONRA
```

- Faz 4 ve Faz 5, Faz 2 tamamlandıktan sonra **paralel** yapılabilir
- Faz 6 (migration) mutlaka en son çalıştırılmalı

**Faz 2 içinde önerilen sıra:**
1. `projectService.ts` (küçük, temel)
2. `brandLeadService.ts` (public case özel durumu var)
3. `marketingService.ts` (en büyük, 30+ fonksiyon)
4. Kalan 11 service alfabetik sırayla
5. Son olarak 3 hook (useDashboardStats, useUserManagement, useAssetManagement)

---

## Risk ve Azaltma Stratejileri

| Risk | Etki | Azaltma |
|------|------|---------|
| Bir query'de `tenantId` unutulması | Tenant-arası data sızıntısı (KRİTİK) | Firestore security rules son savunma hattı + TypeScript zorunlu parametre + code review |
| Security rules'da `getUserTenantId()` extra read | Maliyet + latency artışı | Faz 1'de kabul edilir, sonra Firebase Auth custom claims'e geçilir |
| Composite index patlaması | 200 limit aşımı | Mevcut index'leri audit edip konsolide et |
| Migration sırasında data tutarsızlığı | Eksik `tenantId` olan doc'lar | Code'da fallback: `tenantId \|\| 'default'`, düşük trafik saatinde çalıştır |
| Public endpoint'lere yanlışlıkla auth eklenmesi | Brand wizard, shared report bozulur | Exempt endpoint listesi, integration test |
| OAuth callback'te tenant context kaybı | Platform account `tenantId`'siz kalır | OAuth `state` parametresine `tenantId` eklenir |

---

## Doğrulama Planı

### Her faz sonrası testler:

**Faz 1:**
- `npm run build` başarılı, tip hataları yok
- TenantContext doğru mount ediyor
- Super admin rolü tanımlı

**Faz 2:**
- Tenant A'nın verisi oluştur
- Tenant B'nin verisi oluştur
- Tenant A ile query → sadece A'nın verileri gelmeli
- `tenantId` parametresi olmadan service çağrısı → TypeScript compile error

**Faz 3:**
- Auth header'sız API çağrısı → 401
- Yanlış tenant'ın verisine erişim → 403 veya boş sonuç
- Doğru auth + tenant → başarılı response

**Faz 4:**
- Firebase emulator ile security rules test
- Cross-tenant read/write → deny
- Public endpoint'ler (brand wizard, shared report) → hala çalışıyor

**Faz 5:**
- Super admin login → tenant listesi görünür
- Tenant switch → dashboard verisi değişir
- Normal user → sadece kendi tenant verisi
- Tenant oluşturma/düzenleme çalışıyor

**Faz 6:**
- Migration sonrası: tüm doc'larda `tenantId` var mı kontrol
- Mevcut tüm fonksiyonalite kırılmamış
- Default tenant ile normal çalışma devam ediyor

---

## Özet

| Metrik | Değer |
|--------|-------|
| Toplam değişecek dosya | ~50 |
| Yeni dosya | ~12 |
| Yeni Firestore koleksiyonu | 1 (`tenants`) |
| Güncellenecek koleksiyon | 35+ |
| Güncellenecek API route | 25+ |
| Güncellenecek service dosyası | 14 |
| Güncellenecek hook | 3+ |
| Güncellenecek admin page | Çoğu (service çağrılarına tenantId eklemek) |
| Yeni composite index | ~20-30 |
