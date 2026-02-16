import {
  collection,
  doc,
  addDoc,
  updateDoc,
  deleteDoc,
  getDoc,
  getDocs,
  query,
  where,
  orderBy,
  limit,
  increment,
  Timestamp,
  QueryConstraint,
  serverTimestamp,
} from 'firebase/firestore';
import { db } from '@/lib/firebase/config';
import type {
  AdPlatform,
  CampaignObjective,
  AudienceTargeting,
  BudgetAllocation,
} from '@/shared/types/marketing';
import { getCampaign } from '@/shared/services/marketingService';

// ============================================
// TIPLER
// ============================================

export interface CampaignTemplate {
  id: string;
  name: string;
  description: string;
  category: TemplateCategory;
  objective: CampaignObjective;
  platforms: AdPlatform[];
  targeting: Partial<AudienceTargeting>;
  budgetGuide: {
    suggestedTotal: number;
    suggestedDaily: number;
    currency: 'TRY' | 'USD' | 'EUR';
    platformSplit: Record<string, number>;
  };
  adSetTemplates: Array<{
    name: string;
    platform: AdPlatform;
    bidStrategy: string;
    adTemplates: Array<{
      headline: string;
      primaryText: string;
      description: string;
      cta: string;
    }>;
  }>;
  tags: string[];
  usageCount: number;
  isPublic: boolean;
  sourceCampaignId?: string;
  createdBy: string;
  createdByName: string;
  createdAt: Timestamp;
  updatedAt: Timestamp;
}

export type TemplateCategory =
  | 'ecommerce'
  | 'lead_gen'
  | 'brand_awareness'
  | 'app_install'
  | 'local'
  | 'seasonal'
  | 'custom';

export const TEMPLATE_CATEGORY_LABELS: Record<TemplateCategory, string> = {
  ecommerce: 'E-Ticaret',
  lead_gen: 'Lead Toplama',
  brand_awareness: 'Marka Bilinirlik',
  app_install: 'Uygulama Yukleme',
  local: 'Yerel Isletme',
  seasonal: 'Sezonluk',
  custom: 'Ozel',
};

export const TEMPLATE_CATEGORY_COLORS: Record<TemplateCategory, string> = {
  ecommerce: 'bg-emerald-100 text-emerald-700',
  lead_gen: 'bg-blue-100 text-blue-700',
  brand_awareness: 'bg-purple-100 text-purple-700',
  app_install: 'bg-orange-100 text-orange-700',
  local: 'bg-yellow-100 text-yellow-700',
  seasonal: 'bg-red-100 text-red-700',
  custom: 'bg-neutral-100 text-neutral-600',
};

// ============================================
// KOLEKSIYON SABITI
// ============================================

const TEMPLATES_COLLECTION = 'campaign_templates';

// ============================================
// YARDIMCI FONKSIYONLAR
// ============================================

function stripUndefined(obj: any): any {
  if (obj === null || obj === undefined) return obj;
  if (obj instanceof Timestamp) return obj;
  if (Array.isArray(obj)) return obj.map(stripUndefined);
  if (typeof obj === 'object') {
    const result: any = {};
    for (const [key, val] of Object.entries(obj)) {
      if (val !== undefined) {
        result[key] = stripUndefined(val);
      }
    }
    return result;
  }
  return obj;
}

// ============================================
// CRUD FONKSIYONLARI
// ============================================

/**
 * Yeni bir kampanya sablonu olusturur.
 * usageCount otomatik olarak 0 ile baslar.
 */
export async function createTemplate(
  tenantId: string,
  data: Omit<CampaignTemplate, 'id' | 'createdAt' | 'updatedAt' | 'usageCount'>
): Promise<string> {
  if (!db) throw new Error('Firebase not initialized');

  const templateData = {
    ...stripUndefined(data),
    tenantId,
    usageCount: 0,
    createdAt: Timestamp.now(),
    updatedAt: Timestamp.now(),
  };

  const docRef = await addDoc(
    collection(db, TEMPLATES_COLLECTION),
    templateData
  );
  return docRef.id;
}

/**
 * Sablonlari filtreler ve listeler.
 * Kategori, platform ve arama filtresi destekler.
 */
export async function getTemplates(
  tenantId: string,
  filters?: {
    category?: TemplateCategory;
    platform?: AdPlatform;
    search?: string;
  },
  pageSize: number = 50
): Promise<CampaignTemplate[]> {
  if (!db) throw new Error('Firebase not initialized');

  const constraints: QueryConstraint[] = [
    where('tenantId', '==', tenantId),
  ];

  if (filters?.category) {
    constraints.push(where('category', '==', filters.category));
  }

  if (filters?.platform) {
    constraints.push(where('platforms', 'array-contains', filters.platform));
  }

  constraints.push(orderBy('createdAt', 'desc'));
  constraints.push(limit(pageSize));

  const q = query(collection(db, TEMPLATES_COLLECTION), ...constraints);

  try {
    const snapshot = await getDocs(q);

    let templates: CampaignTemplate[] = snapshot.docs.map((docSnap) => ({
      id: docSnap.id,
      ...docSnap.data(),
    } as CampaignTemplate));

    // Client-side search filtering (Firestore does not support full-text search)
    if (filters?.search) {
      const searchLower = filters.search.toLowerCase();
      templates = templates.filter(
        (t) =>
          t.name.toLowerCase().includes(searchLower) ||
          t.description.toLowerCase().includes(searchLower) ||
          t.tags.some((tag) => tag.toLowerCase().includes(searchLower))
      );
    }

    return templates;
  } catch (err: any) {
    // Composite index may not exist yet -- fallback to unordered query
    if (err?.code === 'failed-precondition') {
      console.warn('[getTemplates] Index missing, falling back to basic query');
      const fallbackQ = query(
        collection(db, TEMPLATES_COLLECTION),
        where('tenantId', '==', tenantId),
        orderBy('createdAt', 'desc'),
        limit(pageSize)
      );
      const snapshot = await getDocs(fallbackQ);
      let templates: CampaignTemplate[] = snapshot.docs.map((docSnap) => ({
        id: docSnap.id,
        ...docSnap.data(),
      } as CampaignTemplate));

      // Apply all filters client-side in fallback
      if (filters?.category) {
        templates = templates.filter((t) => t.category === filters.category);
      }
      if (filters?.platform) {
        templates = templates.filter((t) => t.platforms.includes(filters.platform!));
      }
      if (filters?.search) {
        const searchLower = filters.search.toLowerCase();
        templates = templates.filter(
          (t) =>
            t.name.toLowerCase().includes(searchLower) ||
            t.description.toLowerCase().includes(searchLower) ||
            t.tags.some((tag) => tag.toLowerCase().includes(searchLower))
        );
      }

      return templates;
    }
    throw err;
  }
}

/**
 * Tek bir sablonu ID ile getirir.
 */
export async function getTemplate(tenantId: string, id: string): Promise<CampaignTemplate | null> {
  if (!db) throw new Error('Firebase not initialized');

  const docRef = doc(db, TEMPLATES_COLLECTION, id);
  const docSnap = await getDoc(docRef);

  if (!docSnap.exists()) return null;

  return {
    id: docSnap.id,
    ...docSnap.data(),
  } as CampaignTemplate;
}

/**
 * Mevcut bir sablonu gunceller.
 */
export async function updateTemplate(
  tenantId: string,
  id: string,
  data: Partial<CampaignTemplate>
): Promise<void> {
  if (!db) throw new Error('Firebase not initialized');

  const docRef = doc(db, TEMPLATES_COLLECTION, id);
  await updateDoc(docRef, {
    ...stripUndefined(data),
    updatedAt: serverTimestamp(),
  });
}

/**
 * Bir sablonu siler.
 */
export async function deleteTemplate(tenantId: string, id: string): Promise<void> {
  if (!db) throw new Error('Firebase not initialized');

  await deleteDoc(doc(db, TEMPLATES_COLLECTION, id));
}

/**
 * Sablon kullanim sayacini 1 arttirir.
 */
export async function incrementUsageCount(tenantId: string, id: string): Promise<void> {
  if (!db) throw new Error('Firebase not initialized');

  const docRef = doc(db, TEMPLATES_COLLECTION, id);
  await updateDoc(docRef, {
    usageCount: increment(1),
    updatedAt: serverTimestamp(),
  });
}

/**
 * Mevcut bir kampanyadan sablon olusturur.
 * Kampanyanin hedefleme, platform, butce ve reklam seti bilgilerini ayiklar.
 */
export async function createTemplateFromCampaign(
  tenantId: string,
  campaignId: string,
  name: string,
  description: string,
  category: TemplateCategory,
  createdBy: string,
  createdByName: string
): Promise<string> {
  if (!db) throw new Error('Firebase not initialized');

  const campaign = await getCampaign(tenantId, campaignId);
  if (!campaign) throw new Error('Kampanya bulunamadi');

  // Kampanyadan sablon verisi ayikla
  const totalBudget = campaign.budget?.totalBudget || 0;
  const dailyLimit = campaign.budget?.dailyLimit || 0;
  const currency = campaign.budget?.currency || 'TRY';

  // Platform butce dagilimini hesapla
  const platformSplit: Record<string, number> = {};
  if (campaign.budget?.platformBreakdown?.length) {
    for (const pb of campaign.budget.platformBreakdown) {
      platformSplit[pb.platform] = pb.percentage;
    }
  } else {
    // Esit dagit
    const platformCount = campaign.platforms.length || 1;
    const equalShare = Math.round(100 / platformCount);
    campaign.platforms.forEach((p) => {
      platformSplit[p] = equalShare;
    });
  }

  // Reklam seti sablonlarini ayikla
  const adSetTemplates = (campaign.adSets || []).map((adSet) => ({
    name: adSet.name,
    platform: adSet.platform,
    bidStrategy: adSet.bidStrategy,
    adTemplates: (adSet.ads || []).map((ad) => ({
      headline: ad.creative?.headline || '',
      primaryText: ad.creative?.primaryText || '',
      description: ad.creative?.description || '',
      cta: ad.creative?.callToAction || '',
    })),
  }));

  const templateData: Omit<CampaignTemplate, 'id' | 'createdAt' | 'updatedAt' | 'usageCount'> = {
    name,
    description,
    category,
    objective: campaign.objective,
    platforms: campaign.platforms,
    targeting: campaign.targeting || {},
    budgetGuide: {
      suggestedTotal: totalBudget,
      suggestedDaily: dailyLimit,
      currency,
      platformSplit,
    },
    adSetTemplates,
    tags: campaign.tags || [],
    isPublic: true,
    sourceCampaignId: campaignId,
    createdBy,
    createdByName,
  };

  return createTemplate(tenantId, templateData);
}
