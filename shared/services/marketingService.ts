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
  startAfter,
  Timestamp,
  DocumentSnapshot,
  QueryConstraint,
  serverTimestamp,
} from 'firebase/firestore';
import { db } from '@/lib/firebase/config';
import type {
  MarketingCampaign,
  CampaignSummary,
  CampaignFilters,
  CreateCampaignData,
  UpdateCampaignData,
  CampaignStatus,
  MarketingTimelineEvent,
  CampaignProposal,
  ProposalSummary,
  ProposalFilters,
  ProposalStatus,
  PlatformAccount,
  PerformanceSnapshot,
  OptimizationSuggestion,
  MarketingDashboardStats,
  AdPlatform,
} from '@/shared/types/marketing';
import type { CampaignBreakdown, CampaignAIAnalysis, BreakdownType } from '@/shared/types/breakdown';

// ============================================
// KOLEKSIYON SABITLERI
// ============================================

const CAMPAIGNS_COLLECTION = 'marketing_campaigns';
const PROPOSALS_COLLECTION = 'campaign_proposals';
const PLATFORM_ACCOUNTS_COLLECTION = 'platform_accounts';
const PERFORMANCE_COLLECTION = 'performance_snapshots';
const OPTIMIZATIONS_COLLECTION = 'optimization_suggestions';
const BREAKDOWNS_COLLECTION = 'campaign_breakdowns';
const AI_ANALYSES_COLLECTION = 'campaign_ai_analyses';

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
// KAMPANYA CRUD
// ============================================

export async function createCampaign(
  data: CreateCampaignData,
  createdByUid: string,
  createdByName: string
): Promise<string> {
  if (!db) throw new Error('Firebase not initialized');

  const initialTimeline: MarketingTimelineEvent = {
    id: `evt-${Date.now()}`,
    type: 'created',
    title: 'Kampanya olusturuldu',
    description: `${data.name} kampanyasi olusturuldu`,
    createdAt: Timestamp.now(),
    createdBy: createdByUid,
    createdByName,
  };

  const campaignData: Omit<MarketingCampaign, 'id'> = {
    leadId: data.leadId,
    clientId: data.clientId,
    projectId: data.projectId,
    proposalId: data.proposalId,
    name: data.name,
    description: data.description,
    objective: data.objective,
    platforms: data.platforms,
    status: 'draft',
    budget: data.budget,
    schedule: data.schedule,
    targeting: data.targeting,
    adSets: data.adSets,
    approvalHistory: [],
    platformCampaignIds: {},
    timeline: [initialTimeline],
    tags: [],
    createdAt: Timestamp.now(),
    updatedAt: Timestamp.now(),
  };

  const docRef = await addDoc(
    collection(db, CAMPAIGNS_COLLECTION),
    stripUndefined(campaignData)
  );
  return docRef.id;
}

export async function getCampaign(id: string): Promise<MarketingCampaign | null> {
  if (!db) throw new Error('Firebase not initialized');

  const docRef = doc(db, CAMPAIGNS_COLLECTION, id);
  const docSnap = await getDoc(docRef);

  if (!docSnap.exists()) return null;

  return {
    id: docSnap.id,
    ...docSnap.data(),
  } as MarketingCampaign;
}

export async function updateCampaign(
  id: string,
  data: UpdateCampaignData,
  updatedByUid: string,
  updatedByName: string
): Promise<void> {
  if (!db) throw new Error('Firebase not initialized');

  const docRef = doc(db, CAMPAIGNS_COLLECTION, id);
  const current = await getCampaign(id);
  if (!current) throw new Error('Campaign not found');

  const newEvents: MarketingTimelineEvent[] = [];
  const now = Timestamp.now();

  if (data.status && data.status !== current.status) {
    newEvents.push({
      id: `evt-${Date.now()}`,
      type: 'status_change',
      title: 'Durum degisti',
      description: `${current.status} → ${data.status}`,
      createdAt: now,
      createdBy: updatedByUid,
      createdByName: updatedByName,
    });
  }

  await updateDoc(docRef, {
    ...stripUndefined(data),
    timeline: [...current.timeline, ...newEvents],
    updatedAt: serverTimestamp(),
  });
}

export async function deleteCampaign(id: string): Promise<void> {
  if (!db) throw new Error('Firebase not initialized');
  await deleteDoc(doc(db, CAMPAIGNS_COLLECTION, id));
}

// ============================================
// KAMPANYA LISTELEME VE FILTRELEME
// ============================================

export async function getCampaigns(
  filters?: CampaignFilters,
  pageSize: number = 20,
  lastDoc?: DocumentSnapshot
): Promise<{ campaigns: CampaignSummary[]; lastDoc: DocumentSnapshot | null }> {
  if (!db) throw new Error('Firebase not initialized');

  const constraints: QueryConstraint[] = [];

  if (filters?.status?.length) {
    constraints.push(where('status', 'in', filters.status));
  }

  if (filters?.objective?.length) {
    constraints.push(where('objective', 'in', filters.objective));
  }

  if (filters?.leadId) {
    constraints.push(where('leadId', '==', filters.leadId));
  }

  if (filters?.clientId) {
    constraints.push(where('clientId', '==', filters.clientId));
  }

  if (filters?.projectId) {
    constraints.push(where('projectId', '==', filters.projectId));
  }

  constraints.push(orderBy('createdAt', 'desc'));
  constraints.push(limit(pageSize));

  if (lastDoc) {
    constraints.push(startAfter(lastDoc));
  }

  const q = query(collection(db, CAMPAIGNS_COLLECTION), ...constraints);
  const snapshot = await getDocs(q);

  const campaigns: CampaignSummary[] = snapshot.docs.map((doc) => {
    const data = doc.data() as Omit<MarketingCampaign, 'id'>;
    return {
      id: doc.id,
      name: data.name,
      objective: data.objective,
      platforms: data.platforms,
      status: data.status,
      totalBudget: data.budget?.totalBudget || 0,
      totalSpend: data.performance?.totalSpend || 0,
      performance: data.performance ? {
        impressions: data.performance.totalImpressions,
        clicks: data.performance.totalClicks,
        conversions: data.performance.totalConversions,
        roas: data.performance.overallROAS,
      } : undefined,
      createdAt: data.createdAt,
    };
  });

  const newLastDoc = snapshot.docs[snapshot.docs.length - 1] || null;

  return { campaigns, lastDoc: newLastDoc };
}

// ============================================
// ONAY IS AKISI
// ============================================

export async function approveCampaign(
  campaignId: string,
  approvedByUid: string,
  approvedByName: string,
  notes?: string
): Promise<void> {
  if (!db) throw new Error('Firebase not initialized');

  const campaign = await getCampaign(campaignId);
  if (!campaign) throw new Error('Campaign not found');

  const now = Timestamp.now();

  const approvalEvent = {
    action: 'approved' as const,
    by: approvedByUid,
    byName: approvedByName,
    at: now,
    notes,
  };

  const timelineEvent: MarketingTimelineEvent = {
    id: `evt-${Date.now()}`,
    type: 'approved',
    title: 'Kampanya onaylandi',
    description: notes || `${approvedByName} tarafindan onaylandi`,
    createdAt: now,
    createdBy: approvedByUid,
    createdByName: approvedByName,
  };

  const docRef = doc(db, CAMPAIGNS_COLLECTION, campaignId);
  await updateDoc(docRef, {
    status: 'approved',
    approvalHistory: [...campaign.approvalHistory, approvalEvent],
    timeline: [...campaign.timeline, timelineEvent],
    updatedAt: serverTimestamp(),
  });
}

export async function rejectCampaign(
  campaignId: string,
  rejectedByUid: string,
  rejectedByName: string,
  notes: string
): Promise<void> {
  if (!db) throw new Error('Firebase not initialized');

  const campaign = await getCampaign(campaignId);
  if (!campaign) throw new Error('Campaign not found');

  const now = Timestamp.now();

  const rejectionEvent = {
    action: 'rejected' as const,
    by: rejectedByUid,
    byName: rejectedByName,
    at: now,
    notes,
  };

  const timelineEvent: MarketingTimelineEvent = {
    id: `evt-${Date.now()}`,
    type: 'rejected',
    title: 'Kampanya reddedildi',
    description: notes,
    createdAt: now,
    createdBy: rejectedByUid,
    createdByName: rejectedByName,
  };

  const docRef = doc(db, CAMPAIGNS_COLLECTION, campaignId);
  await updateDoc(docRef, {
    status: 'rejected',
    approvalHistory: [...campaign.approvalHistory, rejectionEvent],
    timeline: [...campaign.timeline, timelineEvent],
    updatedAt: serverTimestamp(),
  });
}

export async function requestRevision(
  campaignId: string,
  requestedByUid: string,
  requestedByName: string,
  notes: string
): Promise<void> {
  if (!db) throw new Error('Firebase not initialized');

  const campaign = await getCampaign(campaignId);
  if (!campaign) throw new Error('Campaign not found');

  const now = Timestamp.now();

  const revisionEvent = {
    action: 'revision' as const,
    by: requestedByUid,
    byName: requestedByName,
    at: now,
    notes,
  };

  const timelineEvent: MarketingTimelineEvent = {
    id: `evt-${Date.now()}`,
    type: 'revision_requested',
    title: 'Revizyon istendi',
    description: notes,
    createdAt: now,
    createdBy: requestedByUid,
    createdByName: requestedByName,
  };

  const docRef = doc(db, CAMPAIGNS_COLLECTION, campaignId);
  await updateDoc(docRef, {
    status: 'revision',
    approvalHistory: [...campaign.approvalHistory, revisionEvent],
    timeline: [...campaign.timeline, timelineEvent],
    updatedAt: serverTimestamp(),
  });
}

// ============================================
// PROPOSAL CRUD
// ============================================

export async function createProposal(
  data: Omit<CampaignProposal, 'id' | 'createdAt' | 'updatedAt'>
): Promise<string> {
  if (!db) throw new Error('Firebase not initialized');

  const proposalData = {
    ...stripUndefined(data),
    createdAt: Timestamp.now(),
    updatedAt: Timestamp.now(),
  };

  const docRef = await addDoc(
    collection(db, PROPOSALS_COLLECTION),
    proposalData
  );
  return docRef.id;
}

export async function getProposal(id: string): Promise<CampaignProposal | null> {
  if (!db) throw new Error('Firebase not initialized');

  const docRef = doc(db, PROPOSALS_COLLECTION, id);
  const docSnap = await getDoc(docRef);

  if (!docSnap.exists()) return null;

  return {
    id: docSnap.id,
    ...docSnap.data(),
  } as CampaignProposal;
}

export async function updateProposalStatus(
  id: string,
  status: ProposalStatus,
  reviewedByUid: string,
  reviewedByName: string,
  notes?: string
): Promise<void> {
  if (!db) throw new Error('Firebase not initialized');

  const docRef = doc(db, PROPOSALS_COLLECTION, id);
  await updateDoc(docRef, {
    status,
    reviewedBy: reviewedByUid,
    reviewedByName,
    reviewedAt: serverTimestamp(),
    reviewNotes: notes || null,
    updatedAt: serverTimestamp(),
  });
}

export async function getProposals(
  filters?: ProposalFilters,
  pageSize: number = 20,
  lastDoc?: DocumentSnapshot
): Promise<{ proposals: ProposalSummary[]; lastDoc: DocumentSnapshot | null }> {
  if (!db) throw new Error('Firebase not initialized');

  const constraints: QueryConstraint[] = [];

  if (filters?.status?.length) {
    constraints.push(where('status', 'in', filters.status));
  }

  if (filters?.leadId) {
    constraints.push(where('leadId', '==', filters.leadId));
  }

  if (filters?.projectId) {
    constraints.push(where('projectId', '==', filters.projectId));
  }

  constraints.push(orderBy('createdAt', 'desc'));
  constraints.push(limit(pageSize));

  if (lastDoc) {
    constraints.push(startAfter(lastDoc));
  }

  const q = query(collection(db, PROPOSALS_COLLECTION), ...constraints);
  const snapshot = await getDocs(q);

  const proposals: ProposalSummary[] = snapshot.docs.map((doc) => {
    const data = doc.data() as Omit<CampaignProposal, 'id'>;
    return {
      id: doc.id,
      leadId: data.leadId,
      leadName: '',
      businessName: '',
      status: data.status,
      platforms: data.strategy?.platforms || [],
      totalBudget: data.budgetPlan?.totalMonthly || 0,
      expectedOutcomeCount: data.expectedOutcomes?.length || 0,
      createdAt: data.createdAt,
    };
  });

  const newLastDoc = snapshot.docs[snapshot.docs.length - 1] || null;

  return { proposals, lastDoc: newLastDoc };
}

// ============================================
// PLATFORM HESAPLARI
// ============================================

export async function getPlatformAccounts(projectId?: string): Promise<PlatformAccount[]> {
  if (!db) throw new Error('Firebase not initialized');

  const constraints: QueryConstraint[] = [];
  if (projectId) {
    constraints.push(where('projectId', '==', projectId));
  }
  constraints.push(orderBy('createdAt', 'desc'));

  const q = query(collection(db, PLATFORM_ACCOUNTS_COLLECTION), ...constraints);

  try {
    const snapshot = await getDocs(q);
    return snapshot.docs.map((doc) => ({
      id: doc.id,
      ...doc.data(),
    })) as PlatformAccount[];
  } catch (err: any) {
    // Composite index may not exist yet — fallback to unordered query
    if (projectId && err?.code === 'failed-precondition') {
      console.warn('[getPlatformAccounts] Index missing, falling back to unordered query');
      const fallbackQ = query(
        collection(db, PLATFORM_ACCOUNTS_COLLECTION),
        where('projectId', '==', projectId)
      );
      const snapshot = await getDocs(fallbackQ);
      return snapshot.docs.map((doc) => ({
        id: doc.id,
        ...doc.data(),
      })) as PlatformAccount[];
    }
    throw err;
  }
}

export async function getPlatformAccount(
  platform: AdPlatform,
  projectId?: string
): Promise<PlatformAccount | null> {
  if (!db) throw new Error('Firebase not initialized');

  const constraints: QueryConstraint[] = [
    where('platform', '==', platform),
    where('status', '==', 'connected'),
  ];
  if (projectId) {
    constraints.push(where('projectId', '==', projectId));
  }
  constraints.push(limit(1));

  const q = query(collection(db, PLATFORM_ACCOUNTS_COLLECTION), ...constraints);
  const snapshot = await getDocs(q);

  if (snapshot.empty) return null;

  return {
    id: snapshot.docs[0].id,
    ...snapshot.docs[0].data(),
  } as PlatformAccount;
}

export async function savePlatformAccount(
  data: Omit<PlatformAccount, 'id' | 'createdAt' | 'updatedAt'>
): Promise<string> {
  if (!db) throw new Error('Firebase not initialized');

  // Upsert: check if account already exists for this platform (+projectId)
  const constraints: QueryConstraint[] = [
    where('platform', '==', data.platform),
  ];
  if (data.projectId) {
    constraints.push(where('projectId', '==', data.projectId));
  }
  constraints.push(limit(1));

  const existing = await getDocs(
    query(collection(db, PLATFORM_ACCOUNTS_COLLECTION), ...constraints)
  );

  if (!existing.empty) {
    // Update existing document
    const existingDoc = existing.docs[0];
    await updateDoc(doc(db, PLATFORM_ACCOUNTS_COLLECTION, existingDoc.id), {
      ...stripUndefined(data),
      updatedAt: serverTimestamp(),
    });
    return existingDoc.id;
  }

  // Create new document
  const accountData = {
    ...stripUndefined(data),
    createdAt: Timestamp.now(),
    updatedAt: Timestamp.now(),
  };

  const docRef = await addDoc(
    collection(db, PLATFORM_ACCOUNTS_COLLECTION),
    accountData
  );
  return docRef.id;
}

export async function updatePlatformAccount(
  id: string,
  data: Partial<PlatformAccount>
): Promise<void> {
  if (!db) throw new Error('Firebase not initialized');

  const docRef = doc(db, PLATFORM_ACCOUNTS_COLLECTION, id);
  await updateDoc(docRef, {
    ...stripUndefined(data),
    updatedAt: serverTimestamp(),
  });
}

export async function disconnectPlatformAccount(id: string): Promise<void> {
  if (!db) throw new Error('Firebase not initialized');

  const docRef = doc(db, PLATFORM_ACCOUNTS_COLLECTION, id);
  await updateDoc(docRef, {
    status: 'disconnected',
    updatedAt: serverTimestamp(),
  });
}

// ============================================
// PERFORMANS VERILERI
// ============================================

export async function savePerformanceSnapshot(
  data: Omit<PerformanceSnapshot, 'id'>
): Promise<string> {
  if (!db) throw new Error('Firebase not initialized');

  const docRef = await addDoc(
    collection(db, PERFORMANCE_COLLECTION),
    stripUndefined(data)
  );
  return docRef.id;
}

export async function getPerformanceSnapshots(
  campaignId: string,
  dateRange?: { start: string; end: string }
): Promise<PerformanceSnapshot[]> {
  if (!db) throw new Error('Firebase not initialized');

  const constraints: QueryConstraint[] = [
    where('campaignId', '==', campaignId),
    orderBy('date', 'desc'),
  ];

  if (dateRange) {
    constraints.push(where('date', '>=', dateRange.start));
    constraints.push(where('date', '<=', dateRange.end));
  }

  const q = query(collection(db, PERFORMANCE_COLLECTION), ...constraints);
  const snapshot = await getDocs(q);

  return snapshot.docs.map((doc) => ({
    id: doc.id,
    ...doc.data(),
  })) as PerformanceSnapshot[];
}

// ============================================
// OPTIMIZASYON ONERILERI
// ============================================

export async function saveOptimizationSuggestion(
  data: Omit<OptimizationSuggestion, 'id'>
): Promise<string> {
  if (!db) throw new Error('Firebase not initialized');

  const docRef = await addDoc(
    collection(db, OPTIMIZATIONS_COLLECTION),
    stripUndefined(data)
  );
  return docRef.id;
}

export async function getOptimizationSuggestions(
  campaignId: string
): Promise<OptimizationSuggestion[]> {
  if (!db) throw new Error('Firebase not initialized');

  const q = query(
    collection(db, OPTIMIZATIONS_COLLECTION),
    where('campaignId', '==', campaignId),
    orderBy('createdAt', 'desc')
  );
  const snapshot = await getDocs(q);

  return snapshot.docs.map((doc) => ({
    id: doc.id,
    ...doc.data(),
  })) as OptimizationSuggestion[];
}

export async function applyOptimization(
  id: string
): Promise<void> {
  if (!db) throw new Error('Firebase not initialized');

  const docRef = doc(db, OPTIMIZATIONS_COLLECTION, id);
  await updateDoc(docRef, {
    status: 'applied',
    appliedAt: serverTimestamp(),
  });
}

// ============================================
// ISTATISTIKLER
// ============================================

export async function getMarketingStats(projectId?: string): Promise<MarketingDashboardStats> {
  if (!db) throw new Error('Firebase not initialized');

  const campaignQuery = projectId
    ? query(collection(db, CAMPAIGNS_COLLECTION), where('projectId', '==', projectId))
    : collection(db, CAMPAIGNS_COLLECTION);

  const proposalConstraints: QueryConstraint[] = [where('status', '==', 'pending')];
  if (projectId) {
    proposalConstraints.push(where('projectId', '==', projectId));
  }

  const [campaignSnap, proposalSnap, accountSnap] = await Promise.all([
    getDocs(campaignQuery),
    getDocs(query(
      collection(db, PROPOSALS_COLLECTION),
      ...proposalConstraints
    )),
    getDocs(query(
      collection(db, PLATFORM_ACCOUNTS_COLLECTION),
      where('status', '==', 'connected')
    )),
  ]);

  let totalSpend = 0;
  let totalImpressions = 0;
  let totalClicks = 0;
  let totalConversions = 0;
  let activeCampaigns = 0;
  let roasSum = 0;
  let roasCount = 0;

  const platformBreakdown: Record<AdPlatform, { campaigns: number; spend: number; conversions: number }> = {
    meta: { campaigns: 0, spend: 0, conversions: 0 },
    google: { campaigns: 0, spend: 0, conversions: 0 },
    tiktok: { campaigns: 0, spend: 0, conversions: 0 },
    linkedin: { campaigns: 0, spend: 0, conversions: 0 },
    email: { campaigns: 0, spend: 0, conversions: 0 },
  };

  campaignSnap.docs.forEach((doc) => {
    const data = doc.data() as Omit<MarketingCampaign, 'id'>;

    if (data.status === 'active') activeCampaigns++;

    if (data.performance) {
      totalSpend += data.performance.totalSpend || 0;
      totalImpressions += data.performance.totalImpressions || 0;
      totalClicks += data.performance.totalClicks || 0;
      totalConversions += data.performance.totalConversions || 0;

      if (data.performance.overallROAS > 0) {
        roasSum += data.performance.overallROAS;
        roasCount++;
      }
    }

    data.platforms?.forEach((platform) => {
      platformBreakdown[platform].campaigns++;
      if (data.performance?.platformBreakdown?.[platform]) {
        platformBreakdown[platform].spend += data.performance.platformBreakdown[platform].spend || 0;
        platformBreakdown[platform].conversions += data.performance.platformBreakdown[platform].conversions || 0;
      }
    });
  });

  const connectedPlatforms = accountSnap.docs.map(
    (doc) => doc.data().platform as AdPlatform
  );

  return {
    totalCampaigns: campaignSnap.size,
    activeCampaigns,
    pendingProposals: proposalSnap.size,
    totalSpend,
    totalImpressions,
    totalClicks,
    totalConversions,
    averageROAS: roasCount > 0 ? roasSum / roasCount : 0,
    platformBreakdown: Object.entries(platformBreakdown).map(([platform, data]) => ({
      platform: platform as AdPlatform,
      ...data,
    })),
    connectedPlatforms,
  };
}

// ============================================
// KAMPANYA NOT EKLEME
// ============================================

// ============================================
// META KAMPANYA SYNC
// ============================================

/**
 * Syncs campaigns from Meta API → Firestore.
 * Calls the sync-campaigns API, then upserts results to Firestore.
 */
export async function syncCampaignsFromMeta(
  projectId: string,
  platform: AdPlatform = 'meta'
): Promise<{ synced: number; error?: string }> {
  if (!db) throw new Error('Firebase not initialized');

  // 1. Get platform account (accessToken + adAccountId)
  const account = await getPlatformAccount(platform, projectId);
  if (!account || !account.metadata?.accessToken || !account.metadata?.adAccountId) {
    return { synced: 0, error: 'Platform hesabi bulunamadi veya token eksik' };
  }

  // 2. Call sync API
  const res = await fetch('/api/marketing/sync-campaigns', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      accessToken: account.metadata.accessToken,
      adAccountId: account.metadata.adAccountId,
    }),
  });

  if (!res.ok) {
    return { synced: 0, error: `API hatasi: ${res.status} ${res.statusText}` };
  }
  const data = await res.json();
  if (!data.success) {
    return { synced: 0, error: data.error || 'Sync basarisiz' };
  }

  // 3. Upsert each campaign to Firestore
  let synced = 0;
  for (const camp of data.campaigns) {
    await upsertCampaignByPlatformId(platform, camp.metaCampaignId, {
      projectId,
      name: camp.name,
      objective: camp.objective,
      platforms: camp.platforms,
      status: camp.status,
      budget: camp.budget,
      schedule: camp.schedule,
      performance: camp.performance ? {
        ...camp.performance,
        lastUpdated: Timestamp.now(),
      } : undefined,
      platformCampaignIds: { [platform]: camp.metaCampaignId },
      ...(camp.adSets ? { adSets: camp.adSets } : {}),
    });
    synced++;
  }

  return { synced };
}

/**
 * Upsert a campaign by its platform campaign ID.
 * If a campaign with the same platformCampaignIds[platform] exists, update it.
 * Otherwise create a new one.
 */
export async function upsertCampaignByPlatformId(
  platform: AdPlatform,
  platformCampaignId: string,
  data: Partial<MarketingCampaign>
): Promise<string> {
  if (!db) throw new Error('Firebase not initialized');

  // Check if campaign already exists with this platform ID
  const q = query(
    collection(db, CAMPAIGNS_COLLECTION),
    where(`platformCampaignIds.${platform}`, '==', platformCampaignId),
    limit(1)
  );

  const snapshot = await getDocs(q);

  if (!snapshot.empty) {
    // Update existing
    const existingDoc = snapshot.docs[0];
    await updateDoc(doc(db, CAMPAIGNS_COLLECTION, existingDoc.id), {
      ...stripUndefined(data),
      updatedAt: serverTimestamp(),
    });
    return existingDoc.id;
  }

  // Create new campaign
  const newCampaign = {
    ...stripUndefined(data),
    description: data.description || '',
    targeting: data.targeting || {},
    adSets: data.adSets || [],
    approvalHistory: [],
    timeline: [{
      id: `evt-${Date.now()}`,
      type: 'created',
      title: 'Meta\'dan senkronize edildi',
      description: `Kampanya Meta Ads hesabindan otomatik olarak iceri aktarildi`,
      createdAt: Timestamp.now(),
      createdBy: 'system',
      createdByName: 'Meta Sync',
    }],
    tags: ['meta-sync'],
    platformCampaignIds: { [platform]: platformCampaignId },
    createdAt: Timestamp.now(),
    updatedAt: Timestamp.now(),
  };

  const docRef = await addDoc(collection(db, CAMPAIGNS_COLLECTION), newCampaign);
  return docRef.id;
}

// ============================================
// KAMPANYA NOT EKLEME
// ============================================

export async function addNoteToCampaign(
  campaignId: string,
  note: string,
  addedByUid: string,
  addedByName: string
): Promise<void> {
  if (!db) throw new Error('Firebase not initialized');

  const campaign = await getCampaign(campaignId);
  if (!campaign) throw new Error('Campaign not found');

  const noteEvent: MarketingTimelineEvent = {
    id: `evt-${Date.now()}`,
    type: 'note',
    title: 'Not eklendi',
    description: note,
    createdAt: Timestamp.now(),
    createdBy: addedByUid,
    createdByName: addedByName,
  };

  const docRef = doc(db, CAMPAIGNS_COLLECTION, campaignId);
  await updateDoc(docRef, {
    timeline: [...campaign.timeline, noteEvent],
    updatedAt: serverTimestamp(),
  });
}

// ============================================
// DEEP SYNC & BREAKDOWN OPERATIONS
// ============================================

/**
 * Deep sync campaigns from Meta API.
 * Like syncCampaignsFromMeta but passes deepSync: true to fetch full details.
 */
export async function deepSyncFromMeta(
  projectId: string,
  platform: AdPlatform = 'meta'
): Promise<{ synced: number; error?: string }> {
  if (!db) throw new Error('Firebase not initialized');

  const account = await getPlatformAccount(platform, projectId);
  if (!account || !account.metadata?.accessToken || !account.metadata?.adAccountId) {
    return { synced: 0, error: 'Platform hesabi bulunamadi veya token eksik' };
  }

  const res = await fetch('/api/marketing/sync-campaigns', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      accessToken: account.metadata.accessToken,
      adAccountId: account.metadata.adAccountId,
      deepSync: true,
    }),
  });

  if (!res.ok) {
    return { synced: 0, error: `API hatasi: ${res.status} ${res.statusText}` };
  }
  const data = await res.json();
  if (!data.success) {
    return { synced: 0, error: data.error || 'Deep sync basarisiz' };
  }

  let synced = 0;
  for (const camp of data.campaigns) {
    await upsertCampaignByPlatformId(platform, camp.metaCampaignId, {
      projectId,
      name: camp.name,
      objective: camp.objective,
      platforms: camp.platforms,
      status: camp.status,
      budget: camp.budget,
      schedule: camp.schedule,
      performance: camp.performance ? {
        ...camp.performance,
        lastUpdated: Timestamp.now(),
      } : undefined,
      platformCampaignIds: { [platform]: camp.metaCampaignId },
      adSets: camp.adSets || [],
      lastSyncAt: Timestamp.now(),
      syncStatus: 'success' as const,
    });
    synced++;
  }

  return { synced };
}

/**
 * Sync performance data at adset or ad level for a single campaign.
 */
export async function syncPerformanceLevel(
  projectId: string,
  campaignId: string,
  metaCampaignId: string,
  level: 'adset' | 'ad'
): Promise<void> {
  if (!db) throw new Error('Firebase not initialized');

  const account = await getPlatformAccount('meta', projectId);
  if (!account || !account.metadata?.accessToken || !account.metadata?.adAccountId) {
    throw new Error('Platform hesabi bulunamadi veya token eksik');
  }

  const res = await fetch('/api/marketing/sync-performance', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      accessToken: account.metadata.accessToken,
      adAccountId: account.metadata.adAccountId,
      level,
      campaigns: [{ campaignId, metaCampaignId }],
    }),
  });

  if (!res.ok) {
    throw new Error(`API hatasi: ${res.status} ${res.statusText}`);
  }
  const data = await res.json();
  if (!data.success) {
    throw new Error(data.error || 'Performance sync basarisiz');
  }

  // Save snapshots to Firestore
  for (const snapshot of data.snapshots || []) {
    await addDoc(
      collection(db, PERFORMANCE_COLLECTION),
      stripUndefined({
        ...snapshot,
        campaignId,
        level,
        updatedAt: serverTimestamp(),
      })
    );
  }
}

/**
 * Sync breakdown data (age_gender, device, placement, region) for a campaign.
 * Uses upsert logic: updates existing breakdown or creates new one.
 */
export async function syncBreakdown(
  projectId: string,
  campaignId: string,
  metaCampaignId: string,
  breakdownType: BreakdownType
): Promise<void> {
  if (!db) throw new Error('Firebase not initialized');

  const account = await getPlatformAccount('meta', projectId);
  if (!account || !account.metadata?.accessToken || !account.metadata?.adAccountId) {
    throw new Error('Platform hesabi bulunamadi veya token eksik');
  }

  const res = await fetch('/api/marketing/sync-breakdowns', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      accessToken: account.metadata.accessToken,
      adAccountId: account.metadata.adAccountId,
      metaCampaignId,
      breakdownType,
    }),
  });

  if (!res.ok) {
    throw new Error(`API hatasi: ${res.status} ${res.statusText}`);
  }
  const data = await res.json();
  if (!data.success) {
    throw new Error(data.error || 'Breakdown sync basarisiz');
  }

  // Upsert: query by campaignId + breakdownType
  const q = query(
    collection(db, BREAKDOWNS_COLLECTION),
    where('campaignId', '==', campaignId),
    where('breakdownType', '==', breakdownType),
    limit(1)
  );
  const existing = await getDocs(q);

  const breakdownData = stripUndefined({
    campaignId,
    metaCampaignId,
    breakdownType,
    dateRange: data.dateRange,
    data: data.data,
    fetchedAt: Timestamp.now(),
    updatedAt: serverTimestamp(),
  });

  if (!existing.empty) {
    const existingDoc = existing.docs[0];
    await updateDoc(doc(db, BREAKDOWNS_COLLECTION, existingDoc.id), breakdownData);
  } else {
    await addDoc(collection(db, BREAKDOWNS_COLLECTION), breakdownData);
  }
}

/**
 * Get breakdown data for a campaign by type.
 * Returns the latest breakdown (ordered by fetchedAt desc, limit 1).
 */
export async function getBreakdownData(
  campaignId: string,
  breakdownType: BreakdownType
): Promise<CampaignBreakdown | null> {
  if (!db) throw new Error('Firebase not initialized');

  const q = query(
    collection(db, BREAKDOWNS_COLLECTION),
    where('campaignId', '==', campaignId),
    where('breakdownType', '==', breakdownType),
    orderBy('fetchedAt', 'desc'),
    limit(1)
  );
  const snapshot = await getDocs(q);

  if (snapshot.empty) return null;

  return {
    id: snapshot.docs[0].id,
    ...snapshot.docs[0].data(),
  } as CampaignBreakdown;
}

// ============================================
// AI ANALYSIS OPERATIONS
// ============================================

/**
 * Run a setup analysis for a campaign via the AI endpoint.
 */
export async function runSetupAnalysis(
  campaignId: string
): Promise<CampaignAIAnalysis> {
  if (!db) throw new Error('Firebase not initialized');

  const res = await fetch('/api/marketing/analyze-campaign', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ campaignId }),
  });

  if (!res.ok) {
    throw new Error(`API hatasi: ${res.status} ${res.statusText}`);
  }
  const data = await res.json();

  return data as CampaignAIAnalysis;
}

/**
 * Run optimization recommendations for a campaign via the AI endpoint.
 */
export async function runOptimizationAnalysis(
  campaignId: string
): Promise<CampaignAIAnalysis> {
  if (!db) throw new Error('Firebase not initialized');

  const res = await fetch('/api/marketing/ai-optimize', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ campaignId }),
  });

  if (!res.ok) {
    throw new Error(`API hatasi: ${res.status} ${res.statusText}`);
  }
  const data = await res.json();

  return data as CampaignAIAnalysis;
}

/**
 * Get the latest AI analysis for a campaign by type.
 * Ordered by generatedAt desc, limit 1.
 */
export async function getLatestAIAnalysis(
  campaignId: string,
  type: 'setup_analysis' | 'optimization_recommendations'
): Promise<CampaignAIAnalysis | null> {
  if (!db) throw new Error('Firebase not initialized');

  const q = query(
    collection(db, AI_ANALYSES_COLLECTION),
    where('campaignId', '==', campaignId),
    where('type', '==', type),
    orderBy('generatedAt', 'desc'),
    limit(1)
  );
  const snapshot = await getDocs(q);

  if (snapshot.empty) return null;

  return {
    id: snapshot.docs[0].id,
    ...snapshot.docs[0].data(),
  } as CampaignAIAnalysis;
}

/**
 * Save an AI analysis result to Firestore.
 */
export async function saveAIAnalysis(
  data: Omit<CampaignAIAnalysis, 'id'>
): Promise<string> {
  if (!db) throw new Error('Firebase not initialized');

  const docRef = await addDoc(
    collection(db, AI_ANALYSES_COLLECTION),
    stripUndefined({
      ...data,
      updatedAt: serverTimestamp(),
    })
  );
  return docRef.id;
}

/**
 * Update campaign sync status (idle, syncing, success, error).
 */
export async function updateCampaignSyncStatus(
  campaignId: string,
  status: 'idle' | 'syncing' | 'success' | 'error',
  error?: string
): Promise<void> {
  if (!db) throw new Error('Firebase not initialized');

  const docRef = doc(db, CAMPAIGNS_COLLECTION, campaignId);
  await updateDoc(docRef, stripUndefined({
    syncStatus: status,
    syncError: error || null,
    ...(status === 'success' ? { lastSyncAt: Timestamp.now() } : {}),
    updatedAt: serverTimestamp(),
  }));
}
